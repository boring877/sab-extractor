// Diagnostic 2: Broaden to find the actual data loading path
// Hook _addItem to see the call stack, and search for related callers

var hookedAddItem = false;
var callStacks = [];

setImmediate(function() {
  Il2Cpp.perform(function() {
    for (var a = 0; a < Il2Cpp.domain.assemblies.length; a++) {
      var assembly = Il2Cpp.domain.assemblies[a];
      for (var c = 0; c < assembly.image.classes.length; c++) {
        var klass = assembly.image.classes[c];
        if (!klass.name.startsWith("CData_") || klass.name.endsWith("_Element")) continue;

        for (var m = 0; m < klass.methods.length; m++) {
          var method = klass.methods[m];
          if (method.name !== "_addItem") continue;
          if (method.virtualAddress.isNull()) continue;

          if (!hookedAddItem) {
            hookedAddItem = true;
            (function(m) {
              Interceptor.attach(m.virtualAddress, {
                onEnter: function(ctx) {
                  if (callStacks.length < 5) {
                    var bt = Thread.backtrace(ctx, Backtracer.ACCURATE)
                      .map(DebugSymbol.fromAddress).join('\n');
                    callStacks.push(bt);
                  }
                }
              });
            })(method);
            send({ type: "diag", msg: "Hooked _addItem at " + method.virtualAddress });
          }
          break;
        }
        if (hookedAddItem) break;
      }
      if (hookedAddItem) break;
    }

    // Also: enumerate ALL methods on one CData class to see full method list
    for (var a2 = 0; a2 < Il2Cpp.domain.assemblies.length; a2++) {
      var assembly2 = Il2Cpp.domain.assemblies[a2];
      for (var c2 = 0; c2 < assembly2.image.classes.length; c2++) {
        var klass2 = assembly2.image.classes[c2];
        if (klass2.name === "CData_ActionSoundEffects") {
          var methods = [];
          var fields = [];
          for (var fi = 0; fi < klass2.fields.length; fi++) {
            fields.push(klass2.fields[fi].name + (klass2.fields[fi].isStatic ? "(static)" : ""));
          }
          for (var mi = 0; mi < klass2.methods.length; mi++) {
            var me = klass2.methods[mi];
            methods.push(me.name + "(" + me.parameterCount + ") addr=" + me.virtualAddress);
          }
          send({ type: "diag", msg: "CData_ActionSoundEffects fields=[" + fields.join(",") + "]" });
          send({ type: "diag", msg: "CData_ActionSoundEffects methods=[" + methods.join("; ") + "]" });

          // Also get base class info
          try {
            var parent = klass2.parent;
            var depth = 0;
            while (parent && depth < 5) {
              var parentMethods = [];
              for (var pm = 0; pm < parent.methods.length; pm++) {
                var pme = parent.methods[pm];
                parentMethods.push(pme.name + "(" + pme.parameterCount + ") addr=" + pme.virtualAddress);
              }
              send({ type: "diag", msg: "Base[" + depth + "] " + parent.name + " methods=[" + parentMethods.join("; ") + "]" });
              parent = parent.parent;
              depth += 1;
            }
          } catch(e) {
            send({ type: "diag", msg: "Base class error: " + e });
          }
          break;
        }
      }
    }

    // Dump call stacks after 20 seconds
    setTimeout(function() {
      for (var i = 0; i < callStacks.length; i++) {
        send({ type: "diag", msg: "CallStack[" + i + "]:\n" + callStacks[i] });
      }
      send({ type: "diag_done" });
    }, 20000);
  });
});
