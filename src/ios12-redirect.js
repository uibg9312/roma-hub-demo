/* Route old Safari 12 to the isolated, compatible edition of the same service. */
(function(){var ua=navigator.userAgent||'';if(/iPad|iPhone|iPod/.test(ua)&&/OS 12[_\.]/.test(ua)&&(location.pathname==='/'||location.pathname==='/index.html')){location.replace('/ios12/'+location.search+location.hash)}})();
