//     Emerson View
//
//     A view...

(function(ns) {

  // Emerson Extension
  // --------------------------------------------------------------------------

  // ### Emerson.view module
  // Entry point for defining a new View.
  var define = ns.view = function(name, setup) {
    return (library[name] = construct(name, setup || {}));
  };

  // ### Module API
  //   * `ns` is a reference to the namespace.
  //   * `init` is a hook for initializing the module.
  _.extend(define, {
    ns   : ns,
    init : function init() {
      configure();
      $('body').view();
    }
  });


  // "Base" Libary Extension
  // --------------------------------------------------------------------------

  // Make a local copy of Emerson.base. e.g., one of jQuery, Zepto or Ender.
  var $ = ns.base;

  // ### $.view
  //
  //     $.view(key);
  //
  // Accessor for defined Views.
  //
  // Note that, while it is possible to manually execute View methods on an
  // object like so:
  //
  //     $.view(key).fn.method.apply(object, arguments);
  //
  // such usage is not recommended as it:
  //
  //   1. circumvents the intentional transience provided by the framework.
  //   2. is likely to cause issues in that the called method will be working
  //      with a non-initialized/-decorated object which may not have the
  //      expected API.
  //
  $.view = function(key) {
    return library[key];
  };

  // ### $.fn.view
  //
  //     $(target).view()
  //
  // Initializes a transiently-decorated object.  In the call to #initialized,
  // and any additional methods called from there, `this` will be wrapped with
  // the View definition.  The returned object is stock: no longer decorated.
  //
  // This method will apply, both, "view" and "trait" behaviors.  Additionally,
  // it works on the surrounding DOM match, as well as nested matches.
  $.fn.view = function() {
    _.each(this, function(e) {
      var keys     = [];
      var element  = $(e);
      var as_view  = element.add(element.find(selectors.view)).filter(selectors.view);
      var as_trait = element.add(element.find(selectors.traits)).filter(selectors.traits);

      _.each(as_view, function(html) {
        var element = $(html);
        attach.apply(element, [element.data(attrs.view)]);
      });

      _.each(as_trait, function(html) {
        var element = $(html);
        attach.apply(element, _.map(element.data(attrs.traits).split(/\s+/), function(key) {
          return [':', key].join('');
        }));
      });
    });

    return this;
  };


  // Internal Objects
  // --------------------------------------------------------------------------

  // ### View constructor.
  //
  // View instances are "subclasses" of the base lib object, decorated with our
  // View.prototype and the provided definition.
  function View() {}

  // View instance setup definition.
  _.extend(View, {
    setup : {
      initialize : function() {},
      subscribe  : {}
    }
  });

  // View instance prototype definition.
  _.extend(View.prototype, {});


  // Internal Implementation
  // --------------------------------------------------------------------------

  // Attr definitions.
  // @private
  var attrs = {};

  // Selector definitions.
  // @private
  var selectors = {};

  // Storage place for the defined Views.
  // @private
  var library = {};

  // Storage place for attachments made.
  // @private
  var attachments = {};

  // emerson id, for tracking attachments.
  // @private
  var _eid = 0;

  // configure
  // @private
  function configure() {
    var config = ns.config('attrs');

    _.extend(attrs, config);
    _.each(config, function(value, key) {
      selectors[key] = '[data-' + value + ']';
    });
  }

  // ### eid
  // Retrieves a unique and persistent ID for the given DOM element.
  // @private
  function eid(element) {
    return element._emerson || (element._emerson = (_eid += 1));
  }

  // ### construct
  // Construct a definition made up of:
  //
  //   1. The provided setup block.
  //   2. A "subclass", extended with the View prototype.
  function construct(name, setup) {
    var sub = _.extend($sub(), {
      constructor : View,
      setup       : _.extend({}, View.setup, setup)
    });

    _.extend(sub.fn, View.prototype);

    return sub;
  }

  // ### attach
  // Given a (complex) list of keys, search the library for applicable View and
  // Trait definitions to apply to the object.
  //
  // Keeps track of which definitions have been applied, and does not re-apply.
  //
  // NOTE: `this`, in this call, should be a baselib-extended object containing
  // a single element.  e.g.,
  //
  //     _.each($(selector), function(element) {
  //       attach.apply($(element), [key, [subkey]]);
  //     });
  function attach() {
    var self = this, def;
    var id   = eid(this[0]);

    _.each(_.flatten(arguments), function(key) {
      var set = (attachments[key] || (attachments[key] = []));
      var built, init, events;

      if(_.include(set, id)) {
        return; // do not re-apply.
      }

      // Build an instance, attach event handlers, initialize and record.
      if(def = library[key]) {
        built  = def(self, self.context);
        init   = def.setup.initialize;
        events = def.setup.subscribe;

        _.each(events, function(handler, key) {
          bind(built, key, handler);
        });

        init.call(built);
        set.push(id);
      }
    });

    return this;
  }

  // ### bind
  // Attach event handler(s).
  //
  //     Emerson.view(key, {
  //       subscribe : {
  //         'click'       : handler,    // simple
  //         'click focus' : handler,    // multiple event types
  //         'selector'    : {           // specific child target
  //           'click'     : handler,
  //           'focus'     : handler
  //         },
  //         document      : {           // bind document, for events
  //           'click'     : handler     // fired outside of the view
  //         }
  //       }
  //     });
  //
  // Note that, in the document-binding case, an event like `click` would be a
  // bad idea.  A more useful (and less costly) use case would be a form of
  // pub/sub.
  //
  // For example, view "A" could trigger an event indicating that it has
  // rendered a new instance, to which "B" (elsewhere) would listen in order
  // to update, say, a count of instances of "A".
  function bind(instance, key, handler, selector) {
    if($.isPlainObject(handler)) {
      _.each(handler, function(subhandler, subkey) {
        bind(instance, subkey, subhandler, key);
      });
    }
    else {
      if(selector === 'document') {
        $(document).on(key, function() {
          return handler.apply(instance, arguments);
        });
      }
      else {
        instance.on(key, selector, function() {
          return handler.apply(instance, arguments);
        });
      }
    }
  }

  // ### $sub
  // Basically a copy of jQuery.sub, but more generic and with changes to:
  //
  //   1. `Sub.extend`
  //      to ensure proper object context is maintained.
  //   2. `Sub.fn.extend`
  //      to ensure proper object context is maintained.
  function $sub() {
    var root;

    function Sub(selector, context) {
      return new Sub.fn.init(selector, context);
    }

    _.extend(true, Sub, $);

    Sub.fn      = Sub.prototype = $();
    Sub.fn.init = function init(selector, context) {
      return $.fn.init.call(this, selector, context, root);
    };

    Sub.fn.constructor    = Sub;
    Sub.fn.init.prototype = Sub.fn;

    Sub.fn.extend = function extend() {
      this.constructor.extend.apply(this.constructor, arguments);
      return this;
    };

    Sub.extend = function extend() {
      var self = this;
      var keep = {
        constructor : this.fn.constructor,
        init        : this.fn.init
      };

      _.each(arguments, function(arg) {
        if(arg.fn) {
          $.extend(self.fn, arg.fn, keep);
        }
        else {
          $.extend(self.fn, arg, keep);
        }
      });

      return self;
    };

    root = Sub(document);
    return Sub;
  }
})(Emerson);
