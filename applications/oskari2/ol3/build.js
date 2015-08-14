require.config({
  baseUrl: "../../../",
  paths: {
    mainConfig: "applications/oskari2/ol3/mainConfig",
    oskari: "src/oskari/oskari",
    "oskari-with-app": "src/oskari/oskari-with-app",
    "oskari-with-loader": "src/oskari/oskari-with-loader",
    "jquery-migrate": "libraries/jquery/jquery-migrate-1.2.1-modified",
    css: "libraries/requirejs/lib/css",
    json: "libraries/requirejs/lib/json",
    domReady: "libraries/requirejs/lib/domReady",
    text: "libraries/requirejs/lib/text",
    i18n: "libraries/requirejs/lib/i18n",
    normalize: "libraries/requirejs/lib/normalize",
    jquery: "empty:",
    'css-builder': "libraries/requirejs/lib/css-builder"
  },
  map: {
    // '*' means all modules will get 'jquery-private'
    // for their 'jquery' dependency.
    "*": {
      "oskari": "oskari-with-app",
      "jquery": "jquery-migrate",
      "ol3": "src/oskari/map-ol3/module",
      "map": "src/oskari/map-ol3/module",
      "mapmodule-plugin": "src/ol3/mapmodule-plugin/module",
      "mapfull": "src/ol3/mapfull/module",
      "divmanazer": "src/framework/divmanazer/module",
      "toolbar": "src/framework/toolbar/module",
      "statehandler": "src/framework/statehandler/module",
      "infobox": "src/framework/infobox/module",
      "search": "src/framework/search/module",
      "layerselector2": "src/framework/layerselector2/module",
      "layerselection2": "src/framework/layerselection2/module",
      "personaldata": "src/framework/personaldata/module",
      "maplegend": "src/framework/maplegend/module",
      "userguide": "src/framework/userguide/module",
      "backendstatus": "src/framework/backendstatus/module",
      "postprocessor": "src/framework/postprocessor/module",
      "publisher": "src/framework/publisher/module",
      "guidedtour": "src/framework/guidedtour/module",
      "mapstats": "src/framework/mapstats/module",
      "mapwfs": "src/framework/mapwfs/module",
      "statsgrid": "src/statistics/statsgrid/module",
      "promote": "src/framework/promote/module"
    },

    // 'jquery-private' wants the real jQuery module
    // though. If this line was not here, there would
    // be an unresolvable cyclic dependency.
    "jquery-migrate": {
      "jquery": "jquery"
    }
  },
  optimize: "none",
  optimizeAllPluginResources: true,
  findNestedDependencies: true,
  name: "applications/oskari2/ol3/main-dev",
  out: "main.js"
});