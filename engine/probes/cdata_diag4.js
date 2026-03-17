// Diagnostic 4: Call GetInstance() on a few classes to see if it creates instances lazily.
// Also call Init with some common parameter patterns to see if we can trigger loads.

setImmediate(function() {
  Il2Cpp.perform(function() {
    var targets = [];
    for (var a = 0; a < Il2Cpp.domain.assemblies.length; a++) {
      var assembly = Il2Cpp.domain.assemblies[a];
      for (var c = 0; c < assembly.image.classes.length; c++) {
        var klass = assembly.image.classes[c];
        if (!klass.name.startsWith("CData_") || klass.name.endsWith("_Element")) continue;
        targets.push(klass);
        if (targets.length >= 10) break;
      }
      if (targets.length >= 10) break;
    }

    for (var i = 0; i < targets.length; i++) {
      var klass = targets[i];
      var className = klass.name;

      // Check m_Instance static field
      try {
        var field = klass.field("m_Instance");
        var val = field.value;
        var isNull = val.isNull();
        send({ type: "diag", msg: className + " m_Instance=" + (isNull ? "null" : val.toString().substring(0, 40)) });
      } catch(e) {
        send({ type: "diag", msg: className + " m_Instance error: " + e });
      }

      // Try calling GetInstance()
      try {
        var getInstance = klass.method("GetInstance", 0);
        var instance = getInstance.invoke();
        if (instance.isNull()) {
          send({ type: "diag", msg: className + " GetInstance() => null" });
        } else {
          send({ type: "diag", msg: className + " GetInstance() => " + instance.toString().substring(0, 60) });
          // Try GetCount
          try {
            var count = instance.method("GetCount", 0).invoke();
            send({ type: "diag", msg: className + " GetCount() => " + count });
          } catch(e2) {
            send({ type: "diag", msg: className + " GetCount() error: " + e2 });
          }
          // Try GetAll
          try {
            var all = instance.method("GetAll", 0).invoke();
            send({ type: "diag", msg: className + " GetAll() => " + all.toString().substring(0, 80) });
          } catch(e3) {
            send({ type: "diag", msg: className + " GetAll() error: " + e3 });
          }
        }
      } catch(e) {
        send({ type: "diag", msg: className + " GetInstance() error: " + e });
      }
    }

    // Also check m_Instance again AFTER GetInstance calls to see if it changed
    send({ type: "diag", msg: "--- Post-GetInstance m_Instance check ---" });
    for (var j = 0; j < targets.length; j++) {
      var k = targets[j];
      try {
        var f = k.field("m_Instance");
        var v = f.value;
        send({ type: "diag", msg: k.name + " m_Instance=" + (v.isNull() ? "null" : "SET!") });
      } catch(e) {}
    }

    send({ type: "diag_done" });
  });
});
