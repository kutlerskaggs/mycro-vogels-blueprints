'use strict';

var async = require('async'),
    _ = require('lodash');

module.exports = {
    scan(req, res) {
        let mycro = req.mycro,
            options = req.options,
            errorService = mycro.services.error,
            serializer = mycro.services.serializer,
            vogelsService = mycro.services.vogels;
        async.waterfall([
            function scan(fn) {
                vogelsService.scan(req, errorService.intercept(true, fn));
            },

            function process(data, fn) {
                serializer.serialize(options.type, data.Items, {
                    topLevelMeta: _(data).pick([
                        'ConsumedCapacity', 'Count', 'ScannedCount'
                    ]).mapKeys(function(value, key) {
                        return _.camelCase(key);
                    }).value()
                }, fn);
            }
        ], errorService.interceptResponse(function(payload) {
            res.json(200, payload);
        }));
    }
};
