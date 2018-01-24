import P from 'bluebird';

import readerParser from 'osgDB/readerParser';
import Registry from 'osgDB/Registry';
import requestFile from 'osgDB/requestFile.js';
import notify from 'osg/notify';

var zip = window.zip;

var typesMap = new window.Map();
var mimeTypes = new window.Map();

var createImageFromURL = function(url) {
    var img = new window.Image();
    img.src = url;
    return new P(function(resolve, reject) {
        img.onerror = function() {
            reject(img);
        };

        img.onload = function() {
            resolve(img);
        };
    });
};

var createImageFromBlob = function(blob) {
    var privateURL = window.URL.createObjectURL(blob);
    var promise = createImageFromURL(privateURL);

    promise.finally(function() {
        window.URL.revokeObjectURL(privateURL);
    });
    return promise;
};

var createArrayBufferFromBlob = function(blob) {
    return new P(function(resolve, reject) {
        var fr = new window.FileReader();

        fr.onerror = function() {
            reject(fr);
        };

        fr.onload = function() {
            resolve(this.result);
        };
        fr.readAsArrayBuffer(blob);
    });
};

var createArrayBufferFromURL = function(url) {
    return requestFile(url, {
        responseType: 'arraybuffer'
    });
};

var createJSONFromURL = function(url) {
    return requestFile(url).then(function(string) {
        return JSON.parse(string);
    });
};

var imageResolver = {
    blob: createImageFromBlob,
    url: createImageFromURL
};

var JSONResolver = {
    string: function(str) {
        return P.resolve(JSON.parse(str));
    }
};

var arrayBufferResolver = {
    blob: createArrayBufferFromBlob,
    url: createArrayBufferFromURL
};

var FileHelper = {
    createJSONFromURL: createJSONFromURL,
    createArrayBufferFromURL: createArrayBufferFromURL,
    createArrayBufferFromBlob: createArrayBufferFromBlob,
    createImageFromBlob: createImageFromBlob,
    createImageFromURL: createImageFromURL,

    resolveFilesMap: function(filesMap) {
        var promises = [];

        filesMap.forEach(function(data, filename) {
            var extension = FileHelper.getExtension(filename);
            var mimetype = FileHelper.getMimeType(extension);

            var createData;
            if (mimetype.match('image')) {
                if (data instanceof String) createData = imageResolver.url;
                else if (data instanceof window.Blob) createData = imageResolver.blob;
            } else if (mimetype.match('json')) {
                createData = JSONResolver.string;
            } else if (mimetype.match('octet-binary')) {
                if (data instanceof String) createData = arrayBufferResolver.url;
                else if (data instanceof window.Blob) createData = arrayBufferResolver.blob;
            }

            var promise;
            if (createData) {
                promise = createData(data).then(function(dataResolved) {
                    filesMap[filesMap] = dataResolved;
                });
            } else {
                promise = P.resolve(data);
            }
            promises.push(promise);
        });

        return P.all(promises);
    },

    _unzipEntry: function(entry) {
        return new P(function(resolve) {
            var filename = entry.filename;
            var extension = FileHelper.getExtension(filename);
            var mimetype = FileHelper.getMimeType(extension);

            var Writer = zip.BlobWriter;
            if (mimetype.match('text') !== null || mimetype.match('json') !== null)
                Writer = zip.TextWriter;
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
                            return resolve(content);
                            //return FileHelper.resolveFilesMap(content);
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

    isImage: function(extension) {
        return mimeTypes.get(extension).match('image') !== null;
    },

    getMimeType: function(extension) {
        return mimeTypes.get(extension);
    },

    getExtension: function(url) {
        return url.substr(url.lastIndexOf('.') + 1);
    },

    // To add user defined types
    addTypeForExtension: function(type, extension) {
        if (typesMap.get(extension) !== undefined) {
            notify.warn("the '" + extension + "' already has a type");
        }
        typesMap.set(extension, type);
    },

    getTypeForExtension: function(extension) {
        return typesMap.get(extension);
    }
};

// Binary
typesMap.set('bin', 'arraybuffer');
typesMap.set('b3dm', 'arraybuffer');
typesMap.set('glb', 'arraybuffer');
typesMap.set('zip', 'arraybuffer');
// Image
typesMap.set('png', 'blob');
typesMap.set('jpg', 'blob');
typesMap.set('jpeg', 'blob');
typesMap.set('gif', 'blob');
// Text
typesMap.set('json', 'string');
typesMap.set('gltf', 'string');
typesMap.set('osgjs', 'string');
typesMap.set('txt', 'string');

mimeTypes.set('bin', 'application/octet-binary');
mimeTypes.set('b3dm', 'application/octet-binary');
mimeTypes.set('glb', 'application/octet-binary');
mimeTypes.set('zip', 'application/octet-binary');
mimeTypes.set('gz', 'application/octet-binary');
// Image
mimeTypes.set('png', 'image/png');
mimeTypes.set('jpg', 'image/jpeg');
mimeTypes.set('jpeg', 'image/jpeg');
mimeTypes.set('gif', 'image/gif');
// Text
mimeTypes.set('json', 'application/json');
mimeTypes.set('gltf', 'text/plain');
mimeTypes.set('osgjs', 'text/plain');
mimeTypes.set('txt', 'text/plain');

export default FileHelper;
