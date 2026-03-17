// Diagnostic 3: Check GetInstance on all CData classes, find stub vs real methods,
// and hook the real (non-stub) Init + LoadData + ParseElement

var STUB_ADDR = null;
var realMethods = {};
var getInstanceClasses = [];

setImmediate(function() {
  Il2Cpp.perform(function() {
    // First pass: find the stub address (most common)
    var addrCounts = {};
    var cdataClasses = [];

    for (var a = 0; a < Il2Cpp.domain.assemblies.length; a++) {
      var assembly = Il2Cpp.domain.assemblies[a];
      for (var c = 0; c < assembly.image.classes.length; c++) {
        var klass = assembly.image.classes[c];
        if (!klass.name.startsWith("CData_") || klass.name.endsWith("_Element")) continue;
        cdataClasses.push(klass);

        for (var m = 0; m < klass.methods.length; m++) {
          var method = klass.methods[m];
          var addr = method.virtualAddress.toString();
          addrCounts[addr] = (addrCounts[addr] || 0) + 1;
        }
      }
    }

    // The most common address is likely the stub
    var sorted = Object.keys(addrCounts).sort(function(a,b) { return addrCounts[b] - addrCounts[a]; });
    send({ type: "diag", msg: "Top addresses: " + sorted.slice(0, 5).map(function(a) { return a + "=" + addrCounts[a]; }).join(", ") });
    STUB_ADDR = sorted[0];

    // Second pass: find real methods (non-stub, non-get/set, non-trivial)
    var hooked = {};

    for (var i = 0; i < cdataClasses.length; i++) {
      var klass = cdataClasses[i];
      var className = klass.name;

      for (var j = 0; j < klass.methods.length; j++) {
        var method = klass.methods[j];
        if (method.virtualAddress.isNull()) continue;
        var addr = method.virtualAddress.toString();
        if (addr === STUB_ADDR) continue;
        if (method.name.startsWith("get_") || method.name.startsWith("set_")) continue;

        if (!realMethods[method.name]) realMethods[method.name] = new Set();
        realMethods[method.name].add(addr);

        // Check GetInstance
        if (method.name === "GetInstance") {
          getInstanceClasses.push(className + " addr=" + addr);
        }
      }
    }

    send({ type: "diag", msg: "Non-stub methods by name:" });
    var names = Object.keys(realMethods).sort();
    for (var n = 0; n < names.length; n++) {
      var nm = names[n];
      var addrs = realMethods[nm];
      send({ type: "diag", msg: "  " + nm + " -> " + addrs.size + " unique addr(s)" });
    }

    send({ type: "diag", msg: "Classes with GetInstance: " + getInstanceClasses.length });
    if (getInstanceClasses.length <= 10) {
      send({ type: "diag", msg: "  " + getInstanceClasses.join(", ") });
    } else {
      send({ type: "diag", msg: "  " + getInstanceClasses.slice(0, 10).join(", ") + " ..." });
    }

    // Hook the REAL Init(3) — the one at unique address, not the stub
    // Also hook real LoadDocument, LoadData, LoadDataBinary, ParseElement, etc.
    var TARGET_METHODS = ["Init", "LoadDocument", "LoadData", "LoadDataBinary", "ParseElement",
                          "ParseHeader", "ParseDataBinaryHeaders", "InitDataByTableName",
                          "LoadAllSubTable", "LoadSingleSubTable", "GetInstance"];
    var hookResults = {};

    for (var ci = 0; ci < cdataClasses.length; ci++) {
      var cklass = cdataClasses[ci];
      for (var mi = 0; mi < cklass.methods.length; mi++) {
        var m = cklass.methods[mi];
        if (m.virtualAddress.isNull()) continue;
        var ma = m.virtualAddress.toString();
        if (ma === STUB_ADDR) continue;
        if (TARGET_METHODS.indexOf(m.name) === -1) continue;
        if (hooked[ma + ":" + m.name]) continue;
        hooked[ma + ":" + m.name] = true;

        var key = m.name + "(" + m.parameterCount + ")";
        if (!hookResults[key]) hookResults[key] = [];
        hookResults[key].push(ma);

        (function(mname, mparam, klassName) {
          try {
            Interceptor.attach(ptr(ma), {
              onEnter: function(ctx) {
                send({ type: "method_call", method: mname, params: mparam, cls: klassName });
              }
            });
          } catch(e) {
            // skip
          }
        })(m.name, m.parameterCount, cklass.name);
      }
    }

    var resultStr = Object.keys(hookResults).map(function(k) {
      return k + " -> " + hookResults[k].length + " hooks";
    }).join(", ");
    send({ type: "diag", msg: "Hooked: " + resultStr });

    // Collect hits for 15 seconds
    var hits = {};
    setTimeout(function() {
      send({ type: "diag_done", msg: JSON.stringify(hits) });
    }, 15000);

    // Patch send to also count hits
    var origSend = send;
    send = function(data) {
      if (data.type === "method_call") {
        var hk = data.cls + "::" + data.method;
        hits[hk] = (hits[hk] || 0) + 1;
        if (Object.keys(hits).length <= 50) {
          origSend(data);
        }
      } else {
        origSend(data);
      }
    };
  });
});
