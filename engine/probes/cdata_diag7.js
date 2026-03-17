// Diagnostic 7: Read m_Data dictionary, enumerate keys/values, read Element fields

setImmediate(function() {
  Il2Cpp.perform(function() {
    var target = null;
    for (var a = 0; a < Il2Cpp.domain.assemblies.length && !target; a++) {
      for (var c = 0; c < Il2Cpp.domain.assemblies[a].image.classes.length && !target; c++) {
        var klass = Il2Cpp.domain.assemblies[a].image.classes[c];
        if (klass.name === "CData_AccountLevel") target = klass;
      }
    }

    var field = target.field("m_Instance");
    var instance = new Il2Cpp.Object(field.value);

    // Read m_Data via get_mData()
    var mData = instance.method("get_mData", 0).invoke();
    send({ type: "diag", msg: "mData type: " + mData.class.type.name });

    // Try Count property
    try {
      var countProp = mData.method("get_Count", 0);
      var count = countProp.invoke();
      send({ type: "diag", msg: "mData.Count = " + count });
    } catch(e) {
      send({ type: "diag", msg: "Count error: " + e });
    }

    // Try enumerating via GetEnumerator
    try {
      var enumerator = mData.method("GetEnumerator", 0).invoke();
      send({ type: "diag", msg: "Enumerator obtained" });

      var entriesRead = 0;
      var maxEntries = 5;
      while (entriesRead < maxEntries) {
        try {
          var hasNext = enumerator.method("MoveNext", 0).invoke();
          if (!hasNext) {
            send({ type: "diag", msg: "MoveNext returned false at entry " + entriesRead });
            break;
          }
        } catch(e) {
          send({ type: "diag", msg: "MoveNext error: " + e });
          break;
        }

        try {
          var current = enumerator.method("get_Current", 0).invoke();
          send({ type: "diag", msg: "Current type: " + current.class.type.name });

          // KeyValuePair has Key and Value properties
          try {
            var key = current.method("get_Key", 0).invoke();
            send({ type: "diag", msg: "  Key: " + key });
          } catch(e) {
            send({ type: "diag", msg: "  Key error: " + e });
          }

          try {
            var value = current.method("get_Value", 0).invoke();
            send({ type: "diag", msg: "  Value type: " + value.class.type.name });

            // Read fields of the Element
            var elementObj = new Il2Cpp.Object(value);
            var elemFields = elementObj.class.fields.filter(function(f) { return !f.isStatic; });
            send({ type: "diag", msg: "  Element fields (" + elemFields.length + "):" });
            for (var i = 0; i < elemFields.length; i++) {
              var ef = elemFields[i];
              try {
                var fval = elementObj.field(ef.name).value;
                var fvalStr = fval.isNull() ? "null" : fval.toString().substring(0, 60);
                send({ type: "diag", msg: "    " + ef.name + " (" + ef.type.name + ") = " + evalStr });
              } catch(e2) {
                send({ type: "diag", msg: "    " + ef.name + " => ERROR: " + e2 });
              }
            }
          } catch(e) {
            send({ type: "diag", msg: "  Value error: " + e });
          }

          entriesRead += 1;
        } catch(e) {
          send({ type: "diag", msg: "get_Current error: " + e });
          break;
        }
      }

      try {
        enumerator.method("Dispose", 0).invoke();
      } catch(e) {}
    } catch(e) {
      send({ type: "diag", msg: "Enumerator error: " + e });
    }

    send({ type: "diag_done" });
  });
});
