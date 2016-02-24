'use strict';

var async = require('async'),
    joi = require('joi'),
    Scan = require('vogels/lib/scan'),
    _ = require('lodash');

let validMethods = [
    'equals', 'eq', 'ne', 'lt', 'lte', 'gt', 'gte', 'null', 'notNull',
    'contains', 'notContains', 'in', 'beginsWith', 'between'
];

function Condition(names, values) {
    this.attributeNames = _.isPlainObject(names) ? names : {};
    this.attributeValues = _.isPlainObject(values) ? values : {};
}

module.exports = {
    convertCriteriaToCondition: function convertCriteriaToCondition(where, options, cb) {
        let self = this;

        // if any conditions are specified in options, use them as the base condition criteria
        var temp = new Scan({},{});
        ['filterExpression', 'expressionAttributeNames', 'expressionAttributeValues'].forEach(function(attr) {
            let presentAttr = options[attr];
            if (presentAttr) {
                temp[attr](presentAttr);
            }
        });

        // loop iterate through criteria.where keys
        let method,
            conditions = [];
        async.each(_.keys(where), function(key, fn) {
            let value = where[key];
            if (key === 'or') {
                self.handleOrClause(value, function(err, cond) {
                    if (err) {
                        return fn(err);
                    }
                    temp.addFilterCondition(cond);
                    fn();
                });
            } else {
                if (!_.isPlainObject(where[key])) {
                    method = 'equals';
                } else {
                    method = _.first(_.keys(value));
                    value = value[method];
                }
                if (validMethods.indexOf(method) === -1) {
                    return fn({
                        status: 400,
                        title: 'Invalid Condition Operator',
                        detail: 'Operator `' + method + '` is not a valid condition operator'
                    });
                }
                conditions.push({
                    key: key,
                    method: method,
                    value: value
                });
                fn();
            }
        }, function(err) {
            if (err) {
                return cb(err);
            }
            conditions.forEach(function(condition) {
                temp.where(condition.key)[condition.method](condition.value);
            });

            let returnCondition = _(temp.request).pick([
                'FilterExpression',
                'ExpressionAttributeNames',
                'ExpressionAttributeValues']).mapKeys(function(value, key) {
                    return _.camelCase(key);
                }).value();

            cb(null, returnCondition);
        });
    },

    ensureRequestOptions(req) {
        req.options = req.options || {};
        if (!_.isPlainObject(req.options)) {
            req.options = {};
        }
    },


    handleOrClause(value, cb) {
        let self = this;
        if (!_.isArray(value)) {
            return cb({
                status: 400,
                title: 'Invalid `OR` Operator',
                detail: 'The `OR` operator must operate on an array'
            });
        }
        async.map(value, function(orWhere, fn) {
            self.convertCriteriaToCondition(orWhere, {}, fn);
        }, function(err, results) {
            if (err) {
                return cb(err);
            }
            let condition = new Condition(),
                expressions = [];
            results.forEach(function(result) {
                let valueNames = _.keys(condition.attributeValues);
                _.transform(result.expressionAttributeValues, function(memo, value, key) {
                    if (!memo[key]) {
                        memo[key] = value;
                        return;
                    }
                    let newKey = self.uniqAttributeValueName(_.trimStart(key, ':'), valueNames);
                    result.filterExpression = result.filterExpression.replace(key, newKey);
                    memo[newKey] = value;
                    return;
                }, condition.attributeValues);
                _.extend(condition.attributeNames, result.expressionAttributeNames);
                expressions.push(result.filterExpression);
            });
            condition.statement = '(' + expressions.join(' OR ') + ')';
            console.log(condition);
            cb(null, condition);
        });
    },

    omitNested(obj, attrs) {
        if (!_.isArray(attrs)) {
            attrs = [attrs];
        }

        var result = _.clone(obj);
        attrs.forEach(function(attr) {
            _.unset(result, attr);
        });
        return result;
    },


    parseCriteria(req, options, cb) {
        let criteria = {
            where: {}
        };

        let limitParam = _.get(options._config, 'queryParams.page.limit') || 'page.limit',
            cursorParam = _.get(req.query, _.get(options._config, 'queryParams.page.cursor') || 'page.cursor'),
            reservedParams = [limitParam, cursorParam];

        // apply defaults
        _.defaults(criteria, {
            limit: _.get(req.query, limitParam),
            startKey: _.get(req.query, cursorParam),
        });

        // merge standalone query params as `where` criteria
        _.merge(criteria, {
            where: this.omitNested(req.query, reservedParams)
        }, this.pickNested(req.query, reservedParams), _.pick(options, [
            'filterExpression', 'expressionAttributeNames', 'expressionAttributeValues'
        ]));

        if (options.blacklist) {
            criteria.where = this.omitNested(criteria.where, options.blacklist);
        }

        if (options.whitelist) {
            criteria.where = this.pickNested(criteria.where, options.whitelist);
        }

        let schema = joi.object({
            where: joi.object().required(),
            filterExpression: joi.string(),
            expressionAttributeNames: joi.object(),
            expressionAttributeValues: joi.object()
        }).with('filterExpression', ['expressionAttributeNames', 'expressionAttributeValues']).requried();

        joi.validate(criteria, schema, {}, cb);
    },


    parseModel(req, options, cb) {
        let modelName = req.options.model || options.modelName,
            model = req.mycro.models[modelName];
        if (!model) {
            return cb({
                status: 500,
                title: 'Parse Model Error',
                detail: 'Unable to locate model with name `' + modelName + '`'
            });
        }
        cb(null, model);
    },


    pickNested(obj, attrs) {
        if (!_.isArray(attrs)) {
            attrs = [attrs];
        }

        var result = {};
        attrs.forEach(function(attr) {
            _.set(result, attr, _.get(obj, attr));
        });
        return result;
    },


    uniqAttributeValueName(key, existingValueNames) {
        var potentialName = ':' + key;
        var idx = 1;

        while(_.includes(existingValueNames, potentialName)) {
            idx++;
            potentialName = ':' + key + '_' + idx;
        }

        return potentialName;
    }
};
