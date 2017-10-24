/*
Switch map URL to test other maps
*/
var mapUrl = 'http://demo.oskari.org/?lang=en&uuid=8016f9be-131b-44ab-bcee-5055628dbd42';

// set source
document.getElementById('map').src = mapUrl;
// set domain (localhost is allowed)
var iFrameDomain = mapUrl.substring(0, mapUrl.indexOf('?'));
// init connection 
var iFrame = document.getElementById('map');
window.channel = OskariRPC.connect(
    iFrame,
    iFrameDomain
);
