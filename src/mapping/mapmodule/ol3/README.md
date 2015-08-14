
/bundles/ol3
=======================


# Summary

Proof-of-Concept ol3 ( https://github.com/openlayers/ol3 ) based mapfull/mapmodule implementation
for oskari.

This is only a partial implementation and will change.

This version inherits from a generalised mapmodule implementation.

Work-in-Progress.
 

# Features migrated

mapmodule-plugin 
- map-module
- wms layers plugin
- wmts layers plugin
- basic navigation 
- panbuttons plugin
- basic events
- basic requests

infobox
- openlayers popup plugin
 
openlayers 2 to ol3 minimal compatibility layer (bounds, some utils) to get the app starting


# Impact on other bundles

Only mapmodule plugins need rewriting. This is howere dependent on the style of coding.
Some parts of OpenLayers 2 have spread across codebase such as basetypes Bounds, Point, ...

Many bundles require no changes at all.
 

# Restrictions

Only the minimum required was coded.

# Future work

Remove duplicate PoC code and implementations.

Design and document dependencies for bundles dependent on ol2, ol3 or a generic dependency of 
a map implementation.

