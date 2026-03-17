// Diagnostic: hook ALL non-trivial CData methods to detect which ones fire during gameplay

var hookLog = [];
var MAX_LOG = 200;
var hookedAddresses = {};

var SKIP_METHODS = {
  "GetCount": true, "GetAll": true, "get_Count": true,
  "ToString": true, "Equals": true, "GetHashCode": true,
  "Finalize": true, "GetType": true, "MemberwiseClone": true,
  ".ctor": true, ".cctor": true
};

setImmediate(function() {
  Il2Cpp.perform(function() {
    var classCount = 0;
    var methodCount = 0;
    var hookCount = 0;

    for (var a = 0; a < Il2Cpp.domain.assemblies.length; a++) {
      var assembly = Il2Cpp.domain.assemblies[a];
      for (var c = 0; c < assembly.image.classes.length; c++) {
        var klass = assembly.image.classes[c];
        if (!klass.name.startsWith("CData_") || klass.name.endsWith("_Element")) {
          continue;
        }
        classCount += 1;

        for (var m = 0; m < klass.methods.length; m++) {
          var method = klass.methods[m];
          if (method.virtualAddress.isNull()) continue;

          var addrStr = method.virtualAddress.toString();
          if (hookedAddresses[addrStr]) continue;
          if (SKIP_METHODS[method.name]) continue;
          if (method.name.startsWith("get_") || method.name.startsWith("set_")) continue;

          methodCount += 1;
          hookedAddresses[addrStr] = method.name;

          (function(mname, cname) {
            Interceptor.attach(ptr(addrStr), {
              onEnter: function() {
                if (hookLog.length < MAX_LOG) {
                  hookLog.push(cname + "::" + mname);
                }
              }
            });
            hookCount += 1;
          })(method.name, klass.name);
        }
      }
    }

    send({ type: "diag_ready", classCount: classCount, uniqueMethods: methodCount, hooksInstalled: hookCount });

    setInterval(function() {
      if (hookLog.length > 0) {
        var snapshot = hookLog.splice(0, MAX_LOG);
        var counts = {};
        for (var i = 0; i < snapshot.length; i++) {
          counts[snapshot[i]] = (counts[snapshot[i]] || 0) + 1;
        }
        send({ type: "diag_hits", hits: counts, totalFired: snapshot.length });
      }
    }, 3000);
  });
});
