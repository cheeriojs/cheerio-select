var parse = require("css-what"),
    compile = require("css-select")._compileToken,
    domutils = require("domutils"),
    find = domutils.find,
    getChildren = domutils.getChildren,
    removeSubsets = domutils.removeSubsets;

var limiters = {
    __proto__: null,
    first: function(){
        return 1;
    },
    eq: dataPlusOne,
    lt: dataPlusOne,
    gt: function(data){
        var num = parseInt(data, 10);
        return isFinite(num) ? Infinity : 0;
    }
};

function dataPlusOne(data){
    var num = parseInt(data, 10);
    return isFinite(num) ? num + 1 : 0;
}

var filters = {
    __proto__: null,
    first: echoElements,
    last: function(elems){
        return elems.length > 0 && [elems[elems.length - 1]];
    },
    eq: function(elems, data){
        var num = parseInt(data, 10);
        return isFinite(num) && Math.abs(num) < elems.length &&
            [num < 0 ? elems[elems.length - num] : elems[num]];
    },
    gt: function(elems, data){
        var num = parseInt(data, 10);
        return isFinite(num) && elems.slice(num);
    },
    lt: echoElements,
    even: function(elems){
        return elems.filter(function(n, i){ return i % 2 === 0; });
    },
    odd: function(elems){
        return elems.filter(function(n, i){ return i % 2 === 1; });
    }
};

function echoElements(elems){
    //already done in `limiters`
    return elems;
}

function isFilter(s){
    return s.type === "pseudo" && s.name in filters;
}

module.exports = function(root, selector, options){
    var sel = parse(selector);
    var results = [], newElems;

    for(var i = 0; i < sel.length; i++){
        for(var j = 0; j < sel[i].length; j++){
            if(isFilter(sel[i][j])){
                newElems = findFilterElements(results, root, sel[i], j, options);
                addElements(results, newElems);
                sel.splice(i, 1); //remove selector
            }
        }
    }

    if(sel.length){
        newElems = findElements(root, sel, options, Infinity);
        addElements(results, newElems);
    }

    return results;
};

function addElements(results, newElems){
    //filter for duplicates
    elemLoop:
        for(var i = 0; i < newElems.length; i++){
            for(var j = 0; j < results.length; j++){
                if(newElems[i] === results[j]) continue elemLoop;
            }
            results.push(newElems[i]);
        }
}

function findFilterElements(result, root, sel, i, options){
    var sub = sel.slice(0, i);
    var filter = sel[i];

    var limit = Infinity;

    if(filter.name in limiters){
        limit = limiters[filter.name](filter.data);
    }

    var elems = findElements(root, [sub], options, limit);

    var res = filters[filter.name](elems, filter.data) || [];

    if(!res.length || sel.length === i + 1){
        return res;
    }

    var rem = sel.slice(i + 1);

    //add a scope token in front of the remaining selector
    rem.unshift({type: "pseudo", name: "scope"});

    for(var j = 0; j < rem.length; j++){
        if(isFilter(rem[j])){
            return findFilterElements(result, root, rem, j, options);
        }
    }

    return findElements(res, rem, options, Infinity);
}

function findElements(root, sel, options, limit){
    if(limit === 0) return [];

    var cmp = compile(sel, options, root);
    var elems = Array.isArray(root) ? removeSubsets(root) : getChildren(root);
    return find(cmp, elems, true, limit);
}
