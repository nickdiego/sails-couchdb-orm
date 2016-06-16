var fs         = require('fs');
var Handlebars = require('handlebars');
var extend     = require('xtend');

var templates = {
  map: Handlebars.compile(fs.readFileSync(__dirname + '/templates/view.map.template.js', 'utf8'))
}

/// Name

exports.name = viewName;

function viewName(where, sort) {
  var name = '';
  if (where)
    name += ['by'].concat(Object.keys(where).sort()).join('_');
  if (sort) {
    if (name.length > 0) name += '_';
    name += ['sortby'].concat(Object.keys(sort)).join('_');
  }
  return name;
};


/// Params

exports.params = params;

function params(where, sort) {
  var params = {};

  if (hasLike(where)) { // where.like will generate params.startkey and key.endkey entries
    var like = where.like;
    params.startkey = params.endkey = [];
    Object.keys(like).sort().forEach(function(key) {
      var value = like[key];
      if ('string' != typeof value) throw new Error('like value must be a string');
      if (value.charAt(value.length - 1) == '%') value = value.substring(0, value.length - 1);
      params.startkey.push(value);
      params.endkey.push(value + '\ufff0');
    });
  } else if (where) { // where.like will generate only params.key entry
    params.key = Object.keys(where).sort().map(function(key) {
      return where[key];
    });
  }

  if (sort) { // add sort options
    // FIXME For now supports only "single-level" sorting
    var firstSortKey = Object.keys(sort).shift();
    params.descending = sort[firstSortKey] === -1;
    if (where) {
      if (params.key) { // sort with where criteria (filter)
        params.startkey = params.endkey = params.key;
        delete params.key;
      }
      if (!params.descending) params.endkey = params.startkey.concat({});
      else params.startkey = params.endkey.concat({});
    }
  }
  return params;

  function hasLike(where) {
    return where && where.like && 'object' == typeof(where.like)
  }
}

/// Create

exports.create = createView;

function createView(db, where, sort, cb) {
  var attributes = [];
  if (where) attributes.push(Object.keys(where).sort().map(fixAttributeName));
  if (sort) attributes.push(Object.keys(sort).map(fixAttributeName));

  var map = templates.map({
    attributes: attributes,
    attribute: attributes.length == 1 && attributes[0],
    singleAttribute: attributes.length == 1
  });

  db.get('_design/views', gotDesignDoc);

  function gotDesignDoc(err, ddoc) {
    if (! ddoc) ddoc = {};
    if (! ddoc.views) ddoc.views = {};
    ddoc.views[viewName(where, sort)] = {
      map: map
    };

    //console.log('ABOUT TO INSERT DDOC', ddoc);

    db.insert(ddoc, '_design/views', cb);
  }
}

function fixAttributeName(attrName) {
  if (attrName == 'id') attrName = '_id';
  return attrName;
}
