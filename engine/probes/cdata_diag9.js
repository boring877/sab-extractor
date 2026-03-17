// Diagnostic 9: Use TryGetValue or Keys/Values to enumerate without KeyValuePair issues

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

    // Try TryGetValue(key, out value) - needs ref parameter
    // Try get_Keys and get_Values instead
    try {
      var keys = instance.method("get_Keys", 0);
      send({ type: "diag", msg: "Has get_Keys? Checking..." });
    } catch(e) {
      send({ type: "diag", msg: "No get_Keys: " + e });
    }

    // Try the dictionary's own methods
    var mData = instance.method("get_mData", 0).invoke();
    send({ type: "diag", msg: "mData methods:" });
    for (var m = 0; m < mData.class.methods.length; m++) {
      var method = mData.class.methods[m];
      if (!method.virtualAddress.isNull()) {
        send({ type: "diag", msg: "  " + method.name + "(" + method.parameterCount + ") addr=" + method.virtualAddress });
      }
    }

    // Try ContainsKey first
    try {
      var containsKey = mData.method("ContainsKey", 1);
      var hasKey1 = containsKey.invoke(1);
      send({ type: "diag", msg: "ContainsKey(1) = " + hasKey1 });
    } catch(e) {
      send({ type: "diag", msg: "ContainsKey error: " + e });
    }

    // Try indexer / get_Item
    try {
      var getItem = mData.method("get_Item", 1);
      var item1 = getItem.invoke(1);
      send({ type: "diag", msg: "get_Item(1) = " + item1 });

      // Try wrapping item as Object
      try {
        var itemObj = new Il2Cpp.Object(item1);
        send({ type: "diag", msg: "Item class: " + itemObj.class.type.name });
        var fields = itemObj.class.fields.filter(function(f) { return !f.isStatic; });
        send({ type: "diag", msg: "Element fields (" + fields.length + "):" });
        for (var i = 0; i < fields.length; i++) {
          try {
            var fv = itemObj.field(fields[i].name).value;
            var fvs = fv.isNull() ? "null" : fv.toString().substring(0, 80);
            send({ type: "diag", msg: "  " + fields[i].name + " (" + fields[i].type.name + ") = " + fvs });
          } catch(err) {
            send({ type: "diag", msg: "  " + fields[i].name + " => " + err });
          }
        }
      } catch(e2) {
        send({ type: "diag", msg: "Wrap item error: " + e2 });
      }
    } catch(e) {
      send({ type: "diag", msg: "get_Item error: " + e });
    }

    send({ type: "diag_done" });
  });
});
