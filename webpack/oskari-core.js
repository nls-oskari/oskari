    // libraries
import 'script-loader!../libraries/requirejs/require-2.2.0.min.js';
import '../libraries/requirejs/text-plugin-2.0.14.js';
import '../libraries/mobile-detect/mobile-detect-1.3.2.js';
import 'expose-loader?DOMPurify!../libraries/dompurify/purify_0.8.0.min.js';
import 'imports-loader?this=>window!../libraries/intl-messageformat/intl-messageformat-with-locales-2.1.0.js';
import '../src/polyfills.js';
    // Oskari global
import '../src/oskari.es6.js';
import '../src/store.js';
import '../src/events.js';
import '../src/util.js';
import '../src/i18n.js';
import '../src/message_types.js';
    // class system
import '../src/class_system.js';
import '../src/bundle_manager.js';

    // user and sandbox
import '../src/user.js';
import '../src/sandbox_factory.js';
import '../src/sandbox/sandbox.js';
import '../src/sandbox/sandbox-state-methods.js';
import '../src/sandbox/sandbox-map-layer-methods.js';
import '../src/sandbox/sandbox-map-methods.js';
import '../src/sandbox/sandbox-abstraction-methods.js';

    // Oskari application helpers
import '../src/loader.js';
import '../src/oskari.app.js';
import '../src/BasicBundle.js';
    // deprecated functions
import '../src/deprecated/deprecated.core.js';
import '../src/deprecated/deprecated.sandbox.js'