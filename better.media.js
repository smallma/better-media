(function() {
    var attrs = {
        // media play
        playingSrc: null,
        mediaDict: {},

        // media record
        // this only support one recording audio at the same time
        recordSec: 0,
        recordSrc: null,
        recordItem: null,
        recordLimitSec: 600000,
        recordCalSecTimer: null,
        recordLimitSecTimer: null
    };

    function BetterMedia (src, options) {
        function _mediaController(src, status) {
            if (!src) {
                return;
            }
            switch (status) {
                case 'play':
                    attrs.mediaDict[src].media.play();
                    attrs.mediaDict[src].opts.playing();
                    attrs.mediaDict[src].status = 'play';
                    break;
                case 'pause':
                    window.clearInterval(attrs.mediaDict[src].calTimer);
                    attrs.mediaDict[src].media.pause();
                    attrs.mediaDict[src].opts.pause();
                    attrs.mediaDict[src].status = 'pause';
                    break;
                case 'stop':
                    window.clearInterval(attrs.mediaDict[src].calTimer);
                    attrs.mediaDict[src].media.stop();
                    attrs.mediaDict[src].opts.ended();
                    attrs.mediaDict[src].playSec = 0;
                    attrs.mediaDict[src].status = 'stop';
                    break;
                case 'ended':
                    window.clearInterval(attrs.mediaDict[src].calTimer);
                    attrs.mediaDict[src].opts.ended();
                    attrs.mediaDict[src].playSec = 0;
                    attrs.mediaDict[src].status = 'ended';
                    break;
                case 'release':
                    window.clearInterval(attrs.mediaDict[src].calTimer);
                    attrs.mediaDict[src].media.release();
                    attrs.mediaDict[src].opts.release();
                    attrs.mediaDict[src] = null;
                    break;
            }
        }

        function _updateSec(src, mediaDictItem, conflictCB, that) {
            return setInterval(function() {
                if (src !== attrs.playingSrc) {
                    console.log('media occurred conflic, playingSrc: ' + attrs.playingSrc + ', stop src: ' + src);
                    conflictCB();
                }

                mediaDictItem.playSec = mediaDictItem.playSec + 1;
                mediaDictItem.opts.timeupdate(mediaDictItem.playSec);
            }, 1000);
        }

        function _initMedia() {
            var that = this,
                mediaDict = attrs.mediaDict;
            
            function playedCB() {
                console.log('Media play end');
                that._mediaController.apply(that, [src, 'ended']);
            }

            function playErrorCB() {
                setTimeout(function() {
                    that._mediaController.apply(that, [src, 'ended']);
                }, 300);
            }

            if (attrs.mediaDict[src]) {
                console.log('Media item exists, empty media item');
                that._mediaController.apply(that, [src, 'ended']);
                // attrs.mediaDict[src] = null;
            } else {
                attrs.mediaDict[src] = {
                    media: null,
                    opts: options,
                    playSec: 0,
                    calTimer: null,
                    status: 'init'
                };
                attrs.mediaDict[src].media = new Media(src, playedCB, playErrorCB);
            }
        }

        this.play = function() {
            var that = this,
                mediaDict = attrs.mediaDict,
                mediaDictItem = mediaDict[src];

            if (!mediaDictItem) {
                _initMedia();
            }

            attrs.playingSrc = src;

            function conflicCB() {
                that.stop(src);
            }
            
            console.log('Media play, src: ' + src);
            this._mediaController(src, 'play');
            mediaDictItem.calTimer = this._updateSec(src, mediaDict[src], conflicCB, that);
        };

        this.pause = function() {
            var mediaDictItem = attrs.mediaDict[src];
            if (mediaDictItem !== 'undefined') {
                console.log('Media pause, src: ' + src);
                this._mediaController(src, 'pause');
            }
        };
        
        this.pauseAll = function() {
            var mediaSrc,
                mediaDict = attrs.mediaDict;

            for (mediaSrc in mediaDict) {
                var mediaDictItem = mediaDict[mediaSrc];
                if (mediaDictItem.status !== 'play') {
                    continue;
                }
                console.log('Media stopAll, stop src: ' + mediaSrc);
                this.pause(mediaSrc);
            }
        };

        this.stop = function() {
            var mediaDictItem = attrs.mediaDict[src];
            if (mediaDictItem !== 'undefined') {
                console.log('Media stop, src: ' + src);
                this._mediaController(src, 'stop');
            }
        };

        this.stopAll = function() {
            var mediaSrc,
                mediaDict = attrs.mediaDict;

            for (mediaSrc in mediaDict) {
                var mediaDictItem = mediaDict[mediaSrc];
                if (mediaDictItem.status !== 'play') {
                    continue;
                }
                console.log('Media stopAll, stop src: ' + mediaSrc);
                this.stop(mediaSrc);
            }
        },

        this.release = function() {
            var mediaDictItem = attrs.mediaDict[src];
            if (mediaDictItem) {
                console.log('Media stop, src: ' + src);
                this._mediaController(src, 'release');
            }
        };

        // media record
        function _getPath(filename, callback) {
            //Function to create a file for iOS recording
            var fsFail = function (error) {
                console.log("Store Media ==> getPath - error creating file for iOS recording");
                if (typeof callback === 'function') {callback();}
            };

            var gotFile = function (file) {
                if (typeof callback === 'function') {
                    var recordSrc = file.toURL();
                    var fullPath = file.fullPath();
                    console.log('recordSrc: ' + recordSrc + ', fullPath: ' + fullPath);
                    callback(recordSrc, fullPath);
                }
            };

            var gotFS = function (fileSystem) {
                fileSystem.root.getFile(filename, {
                    create : true
                }, gotFile, fsFail);
            };

            window.requestFileSystem(LocalFileSystem.TEMPORARY, 0, gotFS, fsFail);
        }

        function _clearRecordTimer() {
            clearTimeout(attrs.recordLimitSecTimer);
            clearTimeout(attrs.recordCalSecTimer);
        }

        function _initRecordMedia(fileName, callback) {
            var that = this;
            function getPwdSuccess(mediaSrc, fullPath) {
                console.log('Start record, src: ' + mediaSrc);
                that._clearRecordTimer();
                attrs.recordSec = 0;
                attrs.recordSrc = fullPath;

                if (mediaSrc) {
                    attrs.recordItem = new Media(mediaSrc, function() {
                        console.log('init media success');
                    }, function(e) {
                        console.error('Store Media ==> initMedia - Init Media failed: ' + JSON.stringify(e));
                    });
                }

                setTimeout(function() {
                    if (typeof callback === 'function') {callback(mediaSrc);}
                }, 1000);
            }

            this._getPath(fileName, getPwdSuccess);
        }

        this.startRecord = function(fileName, updateSecCB) {
            var that = this;

            function startToRecord() {
                attrs.recordItem.startRecord();

                // start to count down
                attrs.recordLimitSecTimer = setTimeout(function() {
                    console.log('Time\'s up, record finished.');
                    
                    attrs.recordItem.stopRecord();
                    that._clearRecordTimer.apply(that);

                }, attrs.recordLimitSec);

                // return record second
                attrs.recordCalSecTimer = setInterval(function() {
                    attrs.recordSec = attrs.recordSec + 1;
                    if (typeof updateSecCB === 'function') {
                        updateSecCB(attrs.recordSec);
                    }
                }, 1000);
            }

            if (!attrs.recordItem) {
                this._initRecordMedia(fileName, startToRecord);
            } else {
                startToRecord();
            }
        };

        this.stopRecord = function() {
            var recordItem = attrs.recordItem;
            if (recordItem) {
                recordItem.stopRecord();
                recordItem.release();
                attrs.recordItem = null;
            }
            this._clearRecordTimer();
        };

        this.getRecordSrc = function() {
            return attrs.recordSrc;
        };

    }
    window.BetterMedia = BetterMedia;
}());