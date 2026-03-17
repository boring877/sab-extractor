// Diagnostic 5: Read m_Instance as raw pointer, try to use it directly for GetCount/GetAll
// The instance is a TableStreamBase, not a plain Object

setImmediate(function() {
  Il2Cpp.perform(function() {
    // Get a class that has m_Instance set
    var target = null;
    for (var a = 0; a < Il2Cpp.domain.assemblies.length && !target; a++) {
      var assembly = Il2Cpp.domain.assemblies[a];
      for (var c = 0; c < assembly.image.classes.length && !target; c++) {
        var klass = assembly.image.classes[c];
        if (klass.name !== "CData_AccountLevel") continue;
        target = klass;
      }
    }
    if (!target) {
      send({ type: "diag", msg: "CData_AccountLevel not found" });
      send({ type: "diag_done" });
      return;
    }

    // Read the static field as a raw pointer
    try {
      var field = target.field("m_Instance");
      var rawVal = field.value;
      send({ type: "diag", msg: "field.value type: " + typeof rawVal + " isNull=" + rawVal.isNull() });
      send({ type: "diag", msg: "field.value toString: " + rawVal.toString().substring(0, 120) });
      send({ type: "diag", msg: "field.handle: " + field.handle });

      // Try wrapping as Il2Cpp.Object
      try {
        var obj = new Il2Cpp.Object(rawVal);
        send({ type: "diag", msg: "Il2Cpp.Object: class=" + obj.class.name + " type=" + obj.class.type.name });
        // Try methods on it
        try {
          var count = obj.method("GetCount", 0).invoke();
          send({ type: "diag", msg: "GetCount() => " + count });
        } catch(e) {
          send({ type: "diag", msg: "GetCount error: " + e });
        }
        try {
          var all = obj.method("GetAll", 0).invoke();
          send({ type: "diag", msg: "GetAll() => " + all.toString().substring(0, 100) });
        } catch(e) {
          send({ type: "diag", msg: "GetAll error: " + e });
        }
      } catch(e2) {
        send({ type: "diag", msg: "Il2Cpp.Object wrap failed: " + e2 });
      }

      // Try Il2Cpp.ValueType
      try {
        var vt = new Il2Cpp.ValueType(rawVal);
        send({ type: "diag", msg: "ValueType wrap OK: " + vt.toString().substring(0, 120) });
      } catch(e3) {
        send({ type: "diag", msg: "ValueType wrap failed: " + e3 });
      }

      // Try using the klass's own method to read the instance
      // m_Instance is on the class itself, not on a CData_AccountLevel instance
      // Try reading the field value and using it as a native pointer directly

      // What if we use Il2Cpp.field.value differently?
      // Try the Il2Cpp.Class.static_field approach
      try {
        var staticFields = target.fields.filter(function(f) { return f.isStatic; });
        send({ type: "diag", msg: "Static fields: " + staticFields.map(function(f) { return f.name + " type=" + f.type.name; }).join(", ") });
      } catch(e4) {
        send({ type: "diag", msg: "static fields enum error: " + e4 });
      }

    } catch(e) {
      send({ type: "diag", msg: "Error: " + e });
    }

    // Alternative: use try/catch with reading the field differently
    // Try directly calling the method on the raw object
    try {
      send({ type: "diag", msg: "--- Trying field.read() approach ---" });
      // In frida-il2cpp-bridge, field.value reads the value
      // But maybe we need to handle it as a reference type
      var field2 = target.field("m_Instance");
      var fieldType = field2.type;
      send({ type: "diag", msg: "m_Instance type: name=" + fieldType.name + " isByRef=" + fieldType.isByRef + " isPrimitive=" + fieldType.isPrimitive });

      // Check if the type is a class (reference type)
      try {
        var fieldClass = fieldType.class;
        send({ type: "diag", msg: "m_Instance class: " + fieldClass.name });
        // Enumerate methods on the field's class (TableStreamBase or whatever)
        var fieldMethods = [];
        for (var fm = 0; fm < fieldClass.methods.length && fm < 20; fm++) {
          fieldMethods.push(fieldClass.methods[fm].name + "(" + fieldClass.methods[fm].parameterCount + ")");
        }
        send({ type: "diag", msg: "m_Instance class methods: " + fieldMethods.join(", ") });
      } catch(e5) {
        send({ type: "diag", msg: "m_Instance class lookup error: " + e5 });
      }
    } catch(e6) {
      send({ type: "diag", msg: "field type approach error: " + e6 });
    }

    send({ type: "diag_done" });
  });
});
