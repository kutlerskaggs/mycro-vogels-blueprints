'use strict';

module.exports = function(mycro) {
    return {
        'v1.0.0': {
            '/api': {
                '/groups': {
                    options: {
                        model: 'groups',
                        type: 'groups'
                    },
                    get: 'vogels.scan'
                },
                '/users': {
                    options: {
                        model: 'users',
                        type: 'users'
                    },
                    get: 'vogels.scan'
                }
            }
        }
    };
};
