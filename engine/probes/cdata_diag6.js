// Diagnostic 6: Try to read data directly from the TableStreamBase internals
// The toString() shows "m_data.count=3" so there IS data

setImmediate(function() {
  Il2Cpp.perform(function() {
    var target = null;
    for (var a = 0; a < Il2Cpp.domain.assemblies.length && !target; a++) {
      for (var c = 0; c < Il2Cpp.domain.assemblies[a].image.classes.length && !target; c++) {
        var klass = Il2Cpp.domain.assemblies[a].image.classes[c];
        if (klass.name === "CData_AccountLevel") target = klass;
      }
    }

    // Get the instance
    var field = target.field("m_Instance");
    var instance = new Il2Cpp.Object(field.value);
    send({ type: "diag", msg: "Instance class: " + instance.class.name });

    // Try enumerating instance fields (non-static) to see the actual data structure
    var instFields = instance.class.fields.filter(function(f) { return !f.isStatic; });
    send({ type: "diag", msg: "Instance fields (" + instFields.length + "):" });
    for (var i = 0; i < instFields.length; i++) {
      var f = instFields[i];
      try {
        var val = instance.field(f.name).value;
        var valStr = val.isNull() ? "null" : val.toString().substring(0, 80);
        send({ type: "diag", msg: "  " + f.name + " (" + f.type.name + ") = " + valStr });
      } catch(e) {
        send({ type: "diag", msg: "  " + f.name + " (" + f.type.name + ") => ERROR: " + e });
      }
    }

    // Also check the parent class (TableStreamBase) fields
    try {
      var parent = instance.class.parent;
      if (parent) {
        var parentFields = parent.fields.filter(function(f) { return !f.isStatic; });
        send({ type: "diag", msg: "Parent fields (" + parent.name + ", " + parentFields.length + "):" });
        for (var j = 0; j < parentFields.length; j++) {
          var pf = parentFields[j];
          try {
            var pval = instance.field(pf.name).value;
            var pvalStr = pval.isNull() ? "null" : pval.toString().substring(0, 80);
            send({ type: "diag", msg: "  " + pf.name + " (" + pf.type.name + ") = " + pvalStr });
          } catch(e) {
            send({ type: "diag", msg: "  " + pf.name + " (" + pf.type.name + ") => ERROR: " + e });
          }
        }

        // Grandparent
        var grandparent = parent.parent;
        if (grandparent) {
          var gpFields = grandparent.fields.filter(function(f) { return !f.isStatic; });
          send({ type: "diag", msg: "Grandparent fields (" + grandparent.name + ", " + gpFields.length + "):" });
          for (var k = 0; k < gpFields.length; k++) {
            var gf = gpFields[k];
            try {
              var gval = instance.field(gf.name).value;
              var gvalStr = gval.isNull() ? "null" : gval.toString().substring(0, 80);
              send({ type: "diag", msg: "  " + gf.name + " (" + gf.type.name + ") = " + gvalStr });
            } catch(e) {
              send({ type: "diag", msg: "  " + gf.name + " (" + gf.type.name + ") => ERROR: " + e });
            }
          }
        }
      }
    } catch(e) {
      send({ type: "diag", msg: "Parent fields error: " + e });
    }

    // Try calling methods on the class directly (static methods that take instance?)
    // Or try reading the m_data dictionary through the base class accessor
    try {
      var getDataMethod = instance.method("get_mData", 0);
      var mData = getDataMethod.invoke();
      send({ type: "diag", msg: "get_mData() => " + mData.toString().substring(0, 100) });
    } catch(e) {
      send({ type: "diag", msg: "get_mData error: " + e });
    }

    send({ type: "diag_done" });
  });
});
