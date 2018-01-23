import P from 'bluebird';

import readerParser from 'osgDB/readerParser';
import Registry from 'osgDB/Registry';
import requestFile from 'osgDB/requestFile.js';
import notify from 'osg/notify';

var zip = window.zip;

var isImages = ['png', 'jpg', 'jpeg', 'gif'];

// Drag'n Drop file helper
// it also holds a list of basic types per extension to do requests.
var FileHelper = {
    createImageFromBlob: function(blob, url) {
        var privateURL = window.URL.createObjectURL(blob);
        var promise = readerParser.readImageURL(privateURL);
        if (url) {
            promise.then(function(osgjsImage) {
                osgjsImage.setURL(url);
            });
        }
        promise.finally(function() {
            window.URL.revokeObjectURL(privateURL);
        });

        return promise;
    },

    createArrayBufferFromBlob: function(blob) {
        return new P(function(resolve, reject) {
            var fr = new FileReader();

            fr.onerror = function() {
                reject(fr);
            };

            fr.onload = function() {
                resolve(this.result);
            };
            fr.readAsArrayBuffer(blob);
        });
    },

    _unzipEntry: function(entry) {
        return new P(function(resolve) {
            var filename = entry.filename;
            var extension = FileHelper.getExtension(filename);
            var mimetype = FileHelper.getMimeType(extension);

            var Writer = zip.BlobWriter;
            if (mimetype.match('text') !== null) {
                Writer = zip.TextWriter;
            }

            // get data from the first file
            entry.getData(new Writer(mimetype), function(data) {
                resolve({
                    filename: filename,
                    data: data
                });
            });
        });
    },

    unzipBlob: function(blob) {
        return new P(function(resolve, reject) {
            // use a zip.BlobReader object to read zipped data stored into blob variable
            var content = new window.Map();
            var filePromises = [];
            zip.createReader(
                new zip.BlobReader(blob),
                function(zipReader) {
                    // get entries from the zip file
                    zipReader.getEntries(function(entries) {
                        for (var i = 0; i < entries.length; i++) {
                            if (entries[i].directory) continue;

                            var promise = FileHelper._unzipEntry(entries[i]);
                            promise.then(function(result) {
                                content.set(result.filename, result.data);
                            });
                            filePromises.push(promise);
                        }

                        P.all(filePromises).then(function() {
                            zipReader.close();
                            resolve(content);
                        });
                    });
                },
                function() {
                    reject(this);
                }
            );
        });
    },

    unzipFile: function(blob) {
        return FileHelper.unzipBlob(blob);
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

            return readerParser.readNodeURL(fileName, {
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
        FileHelper._mimeTypes.set('bin', 'application/octet-binary');
        FileHelper._mimeTypes.set('b3dm', 'application/octet-binary');
        FileHelper._mimeTypes.set('glb', 'application/octet-binary');
        FileHelper._mimeTypes.set('zip', 'application/octet-binary');
        // Image
        FileHelper._mimeTypes.set('png', 'image/png');
        FileHelper._mimeTypes.set('jpg', 'image/jpeg');
        FileHelper._mimeTypes.set('jpeg', 'image/jpeg');
        FileHelper._mimeTypes.set('gif', 'image/gif');
        // Text
        FileHelper._mimeTypes.set('json', 'text/plain');
        FileHelper._mimeTypes.set('gltf', 'text/plain');
        FileHelper._mimeTypes.set('osgjs', 'text/plain');
        FileHelper._mimeTypes.set('txt', 'text/plain');
    },

    isImage: function(extension) {
        return isImages.indexOf(extension) !== -1;
    },

    getMimeType: function(extension) {
        if (!FileHelper._typesMap) {
            FileHelper.init();
        }
        return FileHelper._mimeTypes.get(extension);
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
