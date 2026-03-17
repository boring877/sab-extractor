// Diagnostic 8: Read KeyValuePair as ValueType, extract Key and Value

setImmediate(function() {
  Il2Cpp.perform(function() {
    var target = null;
    for (var a = 0; a < Il2Cpp.domain.assemblies.length && !target; a++) {
      for (var c = 0; c < Il2Cpp.domain.assemblies[a].image.classes.length && !target; c++) {
        var klass = Il2Cpp.domain.assemblies[a].image.classes[c];
        if (klass.name === "CData_AccountLevel") target = klass;
      }
    }

    var instance = new Il2Cpp.Object(target.field("m_Instance").value);
    var mData = instance.method("get_mData", 0).invoke();
    var count = mData.method("get_Count", 0).invoke();
    send({ type: "diag", msg: "mData.Count = " + count });

    var enumerator = mData.method("GetEnumerator", 0).invoke();
    var entriesRead = 0;
    var maxEntries = 3;

    while (entriesRead < maxEntries) {
      try {
        var hasNext = enumerator.method("MoveNext", 0).invoke();
        if (!hasNext) break;
      } catch(e) {
        send({ type: "diag", msg: "MoveNext error: " + e });
        break;
      }

      try {
        var current = enumerator.method("get_Current", 0).invoke();
        send({ type: "diag", msg: "Current raw: " + current });

        // Try as Il2Cpp.Object first
        var currentObj = null;
        try {
          currentObj = new Il2Cpp.Object(current);
        } catch(e1) {
          try {
            currentObj = new Il2Cpp.ValueType(current);
          } catch(e2) {
            send({ type: "diag", msg: "Cannot wrap current: " + e1 + " / " + e2 });
            break;
          }
        }

        // Read Key field
        try {
          var keyField = currentObj.field("key");
          var keyVal = keyField.value;
          send({ type: "diag", msg: "Key = " + keyVal });
        } catch(e) {
          // Try get_Key method
          try {
            var keyMethod = currentObj.method("get_Key", 0);
            var kv = keyMethod.invoke();
            send({ type: "diag", msg: "Key (via getter) = " + kv });
          } catch(e2) {
            send({ type: "diag", msg: "Key error: " + e + " / " + e2 });
          }
        }

        // Read Value field
        try {
          var valueField = currentObj.field("value");
          var valueVal = valueField.value;
          send({ type: "diag", msg: "Value raw = " + valueVal.toString().substring(0, 60) });

          // Wrap value as Object to read its fields
          var valueObj = null;
          try {
            valueObj = new Il2Cpp.Object(valueVal);
            send({ type: "diag", msg: "Value class: " + valueObj.class.type.name });
          } catch(e) {
            send({ type: "diag", msg: "Value wrap error: " + e });
            break;
          }

          // Read all fields of the element
          var elemFields = valueObj.class.fields.filter(function(f) { return !f.isStatic; });
          send({ type: "diag", msg: "Element has " + elemFields.length + " fields:" });
          for (var i = 0; i < elemFields.length; i++) {
            var ef = elemFields[i];
            try {
              var fval = valueObj.field(ef.name).value;
              var fvalStr = fval.isNull() ? "null" : fval.toString().substring(0, 80);
              send({ type: "diag", msg: "  " + ef.name + " (" + ef.type.name + ") = " + fvalStr });
            } catch(err) {
              send({ type: "diag", msg: "  " + ef.name + " => " + err });
            }
          }
        } catch(e) {
          send({ type: "diag", msg: "Value error: " + e });
        }

        entriesRead += 1;
      } catch(e) {
        send({ type: "diag", msg: "get_Current error: " + e });
        break;
      }
    }

    try { enumerator.method("Dispose", 0).invoke(); } catch(e) {}
    send({ type: "diag_done" });
  });
});
