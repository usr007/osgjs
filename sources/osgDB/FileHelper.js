import P from 'bluebird';

import ReaderParser from 'osgDB/readerParser';
import Registry from 'osgDB/Registry';
import requestFile from 'osgDB/requestFile.js';
import Image from 'osg/Image';
import notify from 'osg/notify';

var JSZip = window.JSZip;

// Drag'n Drop file helper
// it also holds a list of basic types per extension to do requests.
var FileHelper = {
    createImageFromBlob: function(blob, url) {
        var img = new window.Image();
        var osgjsImage = new Image();
        return new P(function(resolve) {
            var privateURL = window.URL.createObjectURL(blob);
            img.src = privateURL;
            osgjsImage.setImage(img);
            if (url) osgjsImage.setURL(url);

            img.onerror = function() {
                notify.warn('cant create image');
                window.URL.revokeObjectURL(privateURL);
                resolve(osgjsImage);
            };

            img.onload = function() {
                window.URL.revokeObjectURL(privateURL);
                resolve(osgjsImage);
            };
        });
    },

    unzipFile: function(fileOrBlob) {
        return JSZip.loadAsync(fileOrBlob).then(function(zipContent) {
            var content = new window.Map();
            var filePromises = [];
            Object.keys(zipContent.files).forEach(function(filename) {
                var extension = FileHelper.getExtension(filename);
                var type = FileHelper.getTypeForExtension(extension);

                // use blob as default type
                if (!type) type = 'blob';

                var p = zipContent.files[filename].async(type).then(function(fileData) {
                    content.set(filename, fileData);
                });
                filePromises.push(p);
            });
            return P.all(filePromises).then(function() {
                return content;
            });
        });
    },

    readFileList: function(fileList) {
        var fileName;
        var filesMap = new window.Map();
        var promiseArray = [];
        var i;

        for (i = 0; i < fileList.length; ++i) {
            var ext = FileHelper.getExtension(fileList[i].name);
            var readerWriter = Registry.instance().getReaderWriterForExtension(ext);
            // We need a hack for osgjs til it is converted to a readerwriter
            if (readerWriter !== undefined || ext === 'osgjs') {
                // So this is the main file to read
                fileName = fileList[i].name;
            }

            var type = FileHelper.getTypeForExtension(ext);
            promiseArray.push(
                requestFile(fileList[i], {
                    responseType: type
                })
            );
        }

        return P.all(promiseArray).then(function(files) {
            for (i = 0; i < files.length; ++i) {
                filesMap.set(fileList[i].name, files[i]);
            }

            return ReaderParser.readNodeURL(fileName, {
                filesMap: filesMap
            });
        });
    },

    // Adds basic types
    init: function() {
        FileHelper._typesMap = new window.Map();
        // Binary
        FileHelper._typesMap.set('bin', 'arraybuffer');
        FileHelper._typesMap.set('b3dm', 'arraybuffer');
        FileHelper._typesMap.set('glb', 'arraybuffer');
        FileHelper._typesMap.set('zip', 'arraybuffer');
        // Image
        FileHelper._typesMap.set('png', 'blob');
        FileHelper._typesMap.set('jpg', 'blob');
        FileHelper._typesMap.set('jpeg', 'blob');
        FileHelper._typesMap.set('gif', 'blob');
        // Text
        FileHelper._typesMap.set('json', 'string');
        FileHelper._typesMap.set('gltf', 'string');
        FileHelper._typesMap.set('osgjs', 'string');
        FileHelper._typesMap.set('txt', 'string');

        FileHelper._mimeTypes = new window.Map();
        // Image
        FileHelper._mimeTypes.set('png', 'image');
        FileHelper._mimeTypes.set('jpg', 'image');
        FileHelper._mimeTypes.set('jpeg', 'image');
        FileHelper._mimeTypes.set('gif', 'image');
        // Text
        FileHelper._mimeTypes.set('json', 'string');
        FileHelper._mimeTypes.set('gltf', 'string');
        FileHelper._mimeTypes.set('osgjs', 'string');
        FileHelper._mimeTypes.set('txt', 'string');
    },

    isImage: function(extension) {
        return FileHelper._mimeTypes.get(extension) !== undefined;
    },

    getExtension: function(url) {
        return url.substr(url.lastIndexOf('.') + 1);
    },

    // To add user defined types
    addTypeForExtension: function(type, extension) {
        if (!FileHelper._typesMap) FileHelper.init();
        if (FileHelper._typesMap.get(extension) !== undefined) {
            notify.warn("the '" + extension + "' already has a type");
        }
        FileHelper._typesMap.set(extension, type);
    },

    getTypeForExtension: function(extension) {
        if (!FileHelper._typesMap) {
            FileHelper.init();
        }
        return this._typesMap.get(extension);
    }
};

export default FileHelper;
