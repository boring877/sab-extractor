// CData Capture Probe for Silver and Blood (via frida-il2cpp-bridge)
// Depends on: il2cpp_bridge.js (must be loaded first)

var sentEntries = new Map();
var classStates = new Map();
var seenLoadEvents = new Set();
var fallbackCounters = new Map();
var lastInstanceCounts = new Map();
var MAX_BATCH_ENTRIES = 25;
var MAX_BATCH_CHARS = 1e5;
var FLUSH_INTERVAL_MS = 1e3;
var INSTANCE_SCAN_INTERVAL_MS = 5e3;
var MAX_ENUM_ITEMS = 2e4;

function safeString(value) {
  try {
    return String(value);
  } catch (error) {
    return `stringify_failed:${error}`;
  }
}

function ensureClassState(className) {
  let state = classStates.get(className);
  if (!state) {
    state = {
      batch: new Map(),
      batchCharCount: 0
    };
    classStates.set(className, state);
  }
  return state;
}

function ensureSentEntryMap(className) {
  let existing = sentEntries.get(className);
  if (!existing) {
    existing = new Map();
    sentEntries.set(className, existing);
  }
  return existing;
}

function serializeValue(value, depth) {
  if (depth === void 0) depth = 0;
  if (value === null || value === void 0) {
    return null;
  }
  const primitiveType = typeof value;
  if (primitiveType === "string" || primitiveType === "number" || primitiveType === "boolean") {
    return value;
  }
  if (value instanceof NativePointer) {
    return value.isNull() ? null : value.toString();
  }
  try {
    if (value instanceof Il2Cpp.String) {
      return value.content;
    }
  } catch {
  }
  try {
    if (value instanceof Il2Cpp.Array) {
      const items = [];
      const itemCount = Math.min(value.length, MAX_ENUM_ITEMS);
      for (let index = 0; index < itemCount; index += 1) {
        items.push(serializeValue(value.get(index), depth + 1));
      }
      return items;
    }
  } catch {
  }
  try {
    if (value instanceof Il2Cpp.Object) {
      const typeName = safeString(value.class.type.name);
      if (typeName === "System.String") {
        return value.toString();
      }
      if (depth >= 1) {
        return value.toString();
      }
      return serializeObject(value, depth + 1);
    }
  } catch {
  }
  try {
    if (value instanceof Il2Cpp.ValueType) {
      return value.toString();
    }
  } catch {
  }
  return safeString(value);
}

function serializeObject(object, depth) {
  if (depth === void 0) depth = 0;
  const record = {};
  for (const field of object.class.fields) {
    try {
      if (field.name === "nullObj") {
        record[field.name] = null;
        continue;
      }
      if (field.isStatic) {
        continue;
      }
      const rawValue = readFieldSafe(object, field.name);
      if (rawValue && rawValue.__primitive_unreadable) {
        record[field.name] = readPrimitiveField(object, field.name);
        continue;
      }
      record[field.name] = serializeValue(rawValue, depth + 1);
    } catch {
      record[field.name] = null;
    }
  }
  return record;
}

function normalizeKeyPart(value) {
  if (value === null || value === void 0) {
    return null;
  }
  if (Array.isArray(value)) {
    return value.map(function(item) { return normalizeKeyPart(item) ?? "null"; }).join("_");
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return safeString(value);
    }
  }
  return String(value);
}

function deriveKey(className, record) {
  const compositeCandidates = [
    ["m_SkillGroupID", "m_SkillID"],
    ["m_DmgGroupID", "m_DmgID"],
    ["m_LevelTemplate", "m_Level"],
    ["m_LimitBreakTemplate", "m_LimitBreakLevel"],
    ["m_BrokenGroup", "m_Level"],
    ["m_LevelGroup", "m_Level"],
    ["m_HeroID", "m_StarLevel"],
    ["m_SkillTemplateID", "m_SkillLevel"],
    ["m_BuffGroupID", "m_BuffQuality"]
  ];
  for (const fields of compositeCandidates) {
    const parts = fields.map(function(fieldName) { return normalizeKeyPart(record[fieldName]); }).filter(function(part) { return part !== null; });
    if (parts.length === fields.length) {
      return parts.join("_");
    }
  }
  const singleCandidates = [
    "m_ID",
    "m_HeroID",
    "m_SkillID",
    "m_BuffID",
    "m_SkillValueID",
    "m_DmgGroupID",
    "m_CampID",
    "m_CampSubID",
    "m_CareerID",
    "m_DamageType",
    "m_ElementID",
    "m_TagID",
    "m_LinkID",
    "m_PropertyID",
    "m_LevelTemplate",
    "m_LimitBreakTemplate",
    "m_BuffGroupID",
    "m_BuffRangeID"
  ];
  for (const fieldName of singleCandidates) {
    const key = normalizeKeyPart(record[fieldName]);
    if (key !== null) {
      return key;
    }
  }
  const fallback = (fallbackCounters.get(className) ?? 0) + 1;
  fallbackCounters.set(className, fallback);
  return "entry_" + fallback;
}

function flushBatch(className, state) {
  if (state.batch.size === 0) {
    return;
  }
  const entries = Array.from(state.batch.entries());
  const chunkCount = Math.ceil(entries.length / MAX_BATCH_ENTRIES);
  for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex += 1) {
    const chunkEntries = entries.slice(chunkIndex * MAX_BATCH_ENTRIES, (chunkIndex + 1) * MAX_BATCH_ENTRIES);
    const payload = {};
    for (const [key, entry] of chunkEntries) {
      payload[key] = entry.data;
    }
    send({
      type: "captured_batch",
      className,
      chunkIndex: chunkIndex + 1,
      chunkCount,
      totalEntries: entries.length,
      data: payload
    });
  }
  state.batch.clear();
  state.batchCharCount = 0;
}

function flushAllBatches() {
  for (const [className, state] of classStates.entries()) {
    flushBatch(className, state);
  }
}

function addEntryToBatch(className, key, data, serialized) {
  const state = ensureClassState(className);
  const existing = state.batch.get(key);
  if (existing) {
    state.batchCharCount -= existing.serialized.length;
  }
  state.batch.set(key, { data, serialized });
  state.batchCharCount += serialized.length;
  if (state.batch.size >= MAX_BATCH_ENTRIES || state.batchCharCount >= MAX_BATCH_CHARS) {
    flushBatch(className, state);
  }
}

function classNameFromParsedObject(parsedObject) {
  try {
    const elementClassName = parsedObject.class.name;
    if (!elementClassName.startsWith("CData_") || !elementClassName.endsWith("_Element")) {
      return null;
    }
    return elementClassName.replace(/_Element$/, "");
  } catch {
    return null;
  }
}

function emitLoadEvent(className, methodName) {
  const eventKey = className + ":" + methodName;
  if (seenLoadEvents.has(eventKey)) {
    return;
  }
  seenLoadEvents.add(eventKey);
  send({
    type: "load_event",
    className,
    methodName
  });
}

function toObjectOrNull(value) {
  if (value === null || value === void 0) {
    return null;
  }
  try {
    if (value instanceof Il2Cpp.Object) {
      if (value.isNull()) {
        return null;
      }
      return value;
    }
  } catch {
  }
  try {
    if (value instanceof NativePointer) {
      if (value.isNull()) {
        return null;
      }
      return new Il2Cpp.Object(value);
    }
  } catch {
  }
  return null;
}

function enumerateCollectionValues(collectionObject) {
  const values = [];
  try {
    const enumerator = collectionObject.method("GetEnumerator", 0).invoke();
    let guard = 0;
    while (guard < MAX_ENUM_ITEMS) {
      let hasNext = false;
      try {
        hasNext = !!enumerator.method("MoveNext", 0).invoke();
      } catch {
        break;
      }
      if (!hasNext) {
        break;
      }
      try {
        values.push(enumerator.method("get_Current", 0).invoke());
      } catch {
      }
      guard += 1;
    }
    try {
      enumerator.method("Dispose", 0).invoke();
    } catch {
    }
  } catch {
  }
  return values;
}

function collectElementObjects(value, out, depth) {
  if (depth === void 0) depth = 0;
  if (value === null || value === void 0 || depth > 4 || out.length >= MAX_ENUM_ITEMS) {
    return;
  }
  try {
    if (value instanceof Il2Cpp.Array) {
      const remaining = MAX_ENUM_ITEMS - out.length;
      const itemCount = Math.min(value.length, remaining);
      for (let index = 0; index < itemCount; index += 1) {
        collectElementObjects(value.get(index), out, depth + 1);
      }
      return;
    }
  } catch {
  }
  const objectValue = toObjectOrNull(value);
  if (!objectValue) {
    return;
  }
  const typeName = safeString(objectValue.class.type.name);
  if (typeName.startsWith("CData_") && typeName.endsWith("_Element")) {
    out.push(objectValue);
    return;
  }
  const items = enumerateCollectionValues(objectValue);
  if (items.length > 0) {
    for (const item of items) {
      collectElementObjects(item, out, depth + 1);
      if (out.length >= MAX_ENUM_ITEMS) {
        break;
      }
    }
  }
}

function ingestElementObject(parsedObject, sourceMethod) {
  const className = classNameFromParsedObject(parsedObject);
  if (!className) {
    return false;
  }
  emitLoadEvent(className, sourceMethod);
  const data = serializeObject(parsedObject);
  const key = deriveKey(className, data);
  const serialized = JSON.stringify(data);
  const classEntries = ensureSentEntryMap(className);
  if (classEntries.get(key) === serialized) {
    return false;
  }
  classEntries.set(key, serialized);
  addEntryToBatch(className, key, data, serialized);
  return true;
}

function getClassInstance(klass) {
  try {
    const field = klass.field("m_Instance");
    if (!field || !field.isStatic) {
      return null;
    }
    const raw = field.value;
    if (raw === null || raw === void 0) {
      return null;
    }
    if (raw instanceof NativePointer && raw.isNull()) {
      return null;
    }
    return new Il2Cpp.Object(raw);
  } catch {
    return null;
  }
}

function readFieldSafe(obj, fieldName) {
  try {
    const fhandle = obj.field(fieldName);
    if (fhandle.isStatic) {
      return null;
    }
    return fhandle.value;
  } catch {
    return { __primitive_unreadable: true };
  }
}

function readPrimitiveField(obj, fieldName) {
  try {
    const fhandle = obj.field(fieldName);
    if (fhandle.isStatic) {
      return null;
    }
    const val = fhandle.value;
    if (val === null || val === void 0) {
      return null;
    }
    if (typeof val === "number" || typeof val === "boolean" || typeof val === "string") {
      return val;
    }
    if (val instanceof NativePointer) {
      if (val.isNull()) {
        return null;
      }
      try {
        return val.toInt32();
      } catch {
        return val.toString();
      }
    }
    return val;
  } catch {
    return { __primitive_unreadable: true };
  }
}

function toNumericKey(value) {
  try {
    var n = Number(value);
    if (Number.isFinite(n) && !isNaN(n)) {
      return n;
    }
  } catch {
  }
  try {
    if (value instanceof Il2Cpp.Object) {
      var unbox = value.method("Unbox", 0).invoke();
      if (unbox instanceof NativePointer && !unbox.isNull()) {
        var intVal = unbox.toInt32();
        if (Number.isFinite(intVal)) {
          return intVal;
        }
      }
    }
  } catch {
  }
  try {
    var s = String(value);
    var parsed = parseInt(s, 10);
    if (Number.isFinite(parsed) && !isNaN(parsed)) {
      return parsed;
    }
  } catch {
  }
  return null;
}

function getDictionaryKeys(mData) {
  var keys = [];
  var nanCount = 0;
  try {
    var keysColl = mData.method("get_Keys", 0).invoke();
    var enumerator = keysColl.method("GetEnumerator", 0).invoke();
    var guard = 0;
    while (guard < MAX_ENUM_ITEMS) {
      var hasNext = false;
      try {
        hasNext = !!enumerator.method("MoveNext", 0).invoke();
      } catch {
        break;
      }
      if (!hasNext) {
        break;
      }
      try {
        var current = enumerator.method("get_Current", 0).invoke();
        var numKey = toNumericKey(current);
        if (numKey !== null) {
          keys.push(numKey);
        } else {
          nanCount += 1;
        }
      } catch {
      }
      guard += 1;
    }
    try {
      enumerator.method("Dispose", 0).invoke();
    } catch {
    }
  } catch {
  }
  if (nanCount > 0) {
    send({
      type: "monitor_warning",
      className: "getDictionaryKeys",
      methodName: "toNumericKey",
      message: nanCount + " keys could not be converted to numbers"
    });
  }
  return keys;
}

var CLASS_PROBE_RANGES = {
  "CData_Property": [
    [4080000, 4080070],
    [4090000, 4090070],
    [4100000, 4100070],
    [4110000, 4110010],
    [4010101, 4010101],
    [4020070, 4020071],
    [4030070, 4030073],
    [4050042, 4050042],
    [4060042, 4060042],
    [4070042, 4070042],
    [5020000, 5020900],
    [1000002, 1000009],
    [1001001, 1001003],
    [1002002, 1002002],
    [109010, 109040],
    [110010, 110010],
    [206020, 206040],
    [207010, 207040],
    [209010, 209045],
    [210010, 210045],
    [306010, 306040],
    [307014, 307040],
    [8020231, 8020231],
    [810001, 810034],
    [820001, 820030],
    [830001, 830015],
    [900001, 900009],
    [901001, 901015],
    [902001, 902015],
    [903001, 903009],
    [904007, 904015],
    [905002, 905008],
    [906004, 906005],
    [907002, 907015],
    [908001, 908015],
    [914001, 914021],
    [916003, 916022],
    [918003, 918023],
    [920001, 920015]
  ]
};

function scanLoadedClass(klass) {
  const className = safeString(klass.name);
  const instance = getClassInstance(klass);
  if (!instance) {
    return { addedRows: 0, count: 0 };
  }
  let mData;
  try {
    mData = instance.method("get_mData", 0).invoke();
  } catch {
    return { addedRows: 0, count: 0 };
  }
  let count;
  try {
    count = Number(mData.method("get_Count", 0).invoke());
  } catch {
    return { addedRows: 0, count: 0 };
  }
  if (!Number.isFinite(count) || count <= 0) {
    return { addedRows: 0, count: 0 };
  }
  lastInstanceCounts.set(className, count);
  const keys = getDictionaryKeys(mData);
  let addedRows = 0;
  const getItem = mData.method("get_Item", 1);
  const keysToTry = keys.length > 0 ? keys : [];
  if (keysToTry.length === 0) {
    for (let probeKey = 1; probeKey <= count * 3 + 100; probeKey += 1) {
      keysToTry.push(probeKey);
    }
  } else if (keys.length < count) {
    send({
      type: "monitor_warning",
      className: className,
      methodName: "getDictionaryKeys",
      message: "Dictionary returned " + keys.length + " keys but Count=" + count + ", missing " + (count - keys.length) + " entries"
    });
  }
  const testedKeys = keys.length > 0 ? keys.length : Math.min(count * 3 + 100, MAX_ENUM_ITEMS);
  const seenKeys = new Set(keysToTry);
  for (let ki = 0; ki < Math.min(keysToTry.length, MAX_ENUM_ITEMS); ki += 1) {
    try {
      const item = getItem.invoke(keysToTry[ki]);
      if (item === null || item === void 0) {
        continue;
      }
      if (item instanceof NativePointer && item.isNull()) {
        continue;
      }
      const elementObj = new Il2Cpp.Object(item);
      if (ingestElementObject(elementObj, "InstanceScan")) {
        addedRows += 1;
      }
    } catch {
    }
  }
  const probeRanges = CLASS_PROBE_RANGES[className];
  if (probeRanges) {
    for (const [rangeStart, rangeEnd] of probeRanges) {
      for (let probeKey = rangeStart; probeKey <= rangeEnd; probeKey += 1) {
        if (seenKeys.has(probeKey)) {
          continue;
        }
        try {
          const item = getItem.invoke(probeKey);
          if (item === null || item === void 0) {
            continue;
          }
          if (item instanceof NativePointer && item.isNull()) {
            continue;
          }
          const elementObj = new Il2Cpp.Object(item);
          if (ingestElementObject(elementObj, "TargetedProbe")) {
            addedRows += 1;
          }
        } catch {
        }
      }
    }
  }
  if (addedRows === 0 && count > 0) {
    emitLoadEvent(className, "InstanceCountOnly");
  }
  return { addedRows, count: count };
}

setImmediate(function() {
  Il2Cpp.perform(function() {
    const cdataClasses = [];
    const hookedParseAddresses = new Set();
    const hookedInitAddresses = new Set();
    let hookedLoadBinary = 0;
    let hookedInit = 0;

    for (const assembly of Il2Cpp.domain.assemblies) {
      for (const klass of assembly.image.classes) {
        if (!klass.name.startsWith("CData_") || klass.name.endsWith("_Element")) {
          continue;
        }
        cdataClasses.push(klass);

        for (const method of klass.methods) {
          if (method.virtualAddress.isNull()) {
            continue;
          }
          const addrKey = method.virtualAddress.toString();

          if (method.name === "ParseElement") {
            if (hookedParseAddresses.has(addrKey)) {
              continue;
            }
            hookedParseAddresses.add(addrKey);
            Interceptor.attach(method.virtualAddress, {
              onLeave(retval) {
                if (retval.isNull()) {
                  return;
                }
                try {
                  let parsedObject = null;
                  try {
                    parsedObject = new Il2Cpp.Object(retval);
                  } catch {
                    try {
                      parsedObject = new Il2Cpp.ValueType(retval);
                    } catch {
                      return;
                    }
                  }
                  ingestElementObject(parsedObject, "ParseElement");
                } catch (error) {
                  send({
                    type: "monitor_warning",
                    className: "unknown",
                    methodName: "ParseElement",
                    message: safeString(error)
                  });
                }
              }
            });
          }

          if (method.name === "Init" && method.parameterCount === 3) {
            if (hookedInitAddresses.has(addrKey)) {
              continue;
            }
            hookedInitAddresses.add(addrKey);
            hookedInit += 1;
            const capturedKlass = klass;
            Interceptor.attach(method.virtualAddress, {
              onLeave() {
                try {
                  const result = scanLoadedClass(capturedKlass);
                  if (result.addedRows > 0) {
                    send({
                      type: "monitor_warning",
                      className: safeString(capturedKlass.name),
                      methodName: "Init.onLeave",
                      message: "Init completed, scanned " + result.addedRows + " new rows (count=" + result.count + ")"
                    });
                  }
                } catch (error) {
                  send({
                    type: "monitor_warning",
                    className: safeString(capturedKlass.name),
                    methodName: "Init.onLeave",
                    message: safeString(error)
                  });
                }
              }
            });
          }

          if (method.name === "LoadDataBinary" && method.parameterCount === 2) {
            if (hookedParseAddresses.has(addrKey) || hookedInitAddresses.has(addrKey)) {
              continue;
            }
            hookedParseAddresses.add(addrKey);
            hookedLoadBinary += 1;
            const capturedKlass2 = klass;
            Interceptor.attach(method.virtualAddress, {
              onLeave() {
                try {
                  const result = scanLoadedClass(capturedKlass2);
                  if (result.addedRows > 0) {
                    send({
                      type: "monitor_warning",
                      className: safeString(capturedKlass2.name),
                      methodName: "LoadDataBinary.onLeave",
                      message: "LoadDataBinary completed, scanned " + result.addedRows + " new rows (count=" + result.count + ")"
                    });
                  }
                } catch (error) {
                  send({
                    type: "monitor_warning",
                    className: safeString(capturedKlass2.name),
                    methodName: "LoadDataBinary.onLeave",
                    message: safeString(error)
                  });
                }
              }
            });
          }
        }
      }
    }

    function runInstanceScan(phase) {
      let loadedClasses = 0;
      let addedRows = 0;
      for (const klass of cdataClasses) {
        try {
          const result = scanLoadedClass(klass);
          if (result.count > 0) {
            loadedClasses += 1;
          }
          addedRows += result.addedRows;
        } catch (error) {
          send({
            type: "monitor_warning",
            className: safeString(klass.name),
            methodName: "InstanceScan",
            message: safeString(error)
          });
        }
      }
      send({
        type: "scan_progress",
        phase,
        totalClasses: cdataClasses.length,
        loadedClasses,
        addedRows
      });
    }

    send({
      type: "monitor_ready",
      hookedParseMethods: hookedParseAddresses.size,
      hookedLoadMethods: hookedLoadBinary,
      hookedInitMethods: hookedInit,
      registeredInstances: 0
    });

    setInterval(flushAllBatches, FLUSH_INTERVAL_MS);
    setInterval(function() { runInstanceScan("periodic"); }, INSTANCE_SCAN_INTERVAL_MS);
    setTimeout(function() { runInstanceScan("initial"); }, 500);
  });
});
