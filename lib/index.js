'use strict';

var _ = require('lodash');

module.exports = function(done) {
    let mycro = this;

    if (!mycro.services) {
        return done('mycro-vogels-blueprints requires the default services hook');
    }

    if (mycro.services.vogels) {
        return done('a `vogels` service is already defined');
    }

    let config = _.get(mycro, '_config.vogels-blueprints') || {},
        vogelsService = require('./services/vogels')(mycro, config);
    mycro.services.vogels = vogelsService;
    done();
};
