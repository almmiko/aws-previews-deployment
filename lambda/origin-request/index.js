exports.handler = (event, context, callback) => {
    const { request } = event.Records[0].cf;

    const branch = request.headers.host[0].value.match(/[^\.]+/)[0];

    request.origin.custom.path = `/${branch}`;

    request.headers['host'] = [{ key: 'host', value: request.origin.custom.domainName }];

    return callback(null, request);
};
