'use strict';

var async = require('async'),
    util = require('../util'),
    _ = require('lodash');

module.exports = function(mycro, config) {
    return {
        scan(req, options, cb) {
            if (_.isFunction(options)) {
                cb = options;
                options = {};
            }

            options._config = config;

            util.ensureRequestOptions(req);

            async.auto({
                model: function parseModel(fn) {
                    util.parseModel(req, options, fn);
                },

                criteria: function parseCriteria(fn) {
                    util.parseCriteria(req, options, fn);
                },

                scan: ['model', function createScan(fn, r) {
                    let scan = r.model.scan();
                    fn(null, scan);
                }],

                processCriteria: ['criteria', function processCriteria(fn, r) {
                    if (_.isFunction(options.processCriteria)) {
                        return options.processCriteria(r.criteria, fn);
                    }
                    fn();
                }],

                condition: ['processCriteria', function convertCriteria(fn, r) {
                    util.convertCriteriaToCondition(r.criteria, options, fn);
                }],

                applyConditions: ['scan', 'condition', function applyConditions(fn, r) {
                    let scan = r.scan,
                        criteria = r.criteria,
                        condition = r.condition;
                    if (condition.filterExpression.length) {
                        scan.filterExpression(condition.filterExpression);
                    }
                    if (_.keys(condition.expressionAttributeNames).length) {
                        scan.expressionAttributeNames(condition.expressionAttributeNames);
                    }
                    if (_.keys(condition.expressionAttributeValues).length) {
                        scan.expressionAttributeValues(condition.expressionAttributeValues);
                    }
                    if (criteria.limit) {
                        scan.limit(criteria.limit);
                    }
                    if (criteria.startKey) {
                        scan.startKey(criteria.startKey);
                    }
                    if (options.returnConsumedCapacity) {
                        scan.returnConsumedCapacity();
                    }
                }],

                data: ['applyConditions', function exec(fn, r) {
                    r.scan.exec(fn);
                }]
            }, function(err, r) {
                if (err) {
                    return cb(err);
                }
                cb(null, r.data);
            });
        }
    };
};
