setTimeout(function() {

    var socketOptions = {
        hostname: lh.nodejsHelperOptions.hostname,
        path: lh.nodejsHelperOptions.path
    }

    if (lh.nodejsHelperOptions.port != '') {
        socketOptions.port = parseInt(lh.nodejsHelperOptions.port);
    }

    if (lh.nodejsHelperOptions.secure == 1) {
        socketOptions.secure = true;
    }

    var chanelName;

    if (lh.nodejsHelperOptions.instance_id > 0) {
        chanelName = ('chat_'+lh.nodejsHelperOptions.instance_id+'_'+lhinst.chat_id);
    } else{
        chanelName = ('chat_'+lhinst.chat_id);
    }

    // Initiate the connection to the server
    var socket = socketCluster.connect(socketOptions);

    var sampleChannel = null;

    socket.on('error', function (err) {
        console.error(err);
    });

    function visitorTypingListener(data)
    {
        if (lh.nodejsHelperOptions.instance_id > 0) {
            socket.publish('chat_'+lh.nodejsHelperOptions.instance_id+'_'+lhinst.chat_id,{'op':'vt','msg':data.msg});
        } else {
            socket.publish('chat_'+lhinst.chat_id,{'op':'vt','msg':data.msg});
        }
    }

    function visitorTypingStoppedListener()
    {
        if (lh.nodejsHelperOptions.instance_id > 0) {
            socket.publish('chat_'+lh.nodejsHelperOptions.instance_id+'_'+lhinst.chat_id,{'op':'vts'});
        } else {
            socket.publish('chat_'+lhinst.chat_id,{'op':'vts'});
        }
    }

    socket.on('close', function(){
        LHCCallbacks.initTypingMonitoringUserInform = false;

        if (sampleChannel !== null) {
            sampleChannel.destroy();
        }

        ee.removeListener('visitorTyping', visitorTypingListener);
        ee.removeListener('visitorTypingStopped', visitorTypingStoppedListener);

        confLH.chat_message_sinterval = confLH.defaut_chat_message_sinterval;
    });

    function connectVisitor(){
        if (lh.nodejsHelperOptions.instance_id > 0) {
            sampleChannel = socket.subscribe('chat_'+lh.nodejsHelperOptions.instance_id+'_'+lhinst.chat_id);
        } else {
            sampleChannel = socket.subscribe('chat_' + lhinst.chat_id);
        }

        sampleChannel.on('subscribeFail', function (err) {
            console.error('Failed to subscribe to the sample channel due to error: ' + err);
        });

        sampleChannel.on('subscribe', function () {
            socket.publish((lh.nodejsHelperOptions.instance_id > 0 ? 'chat_'+lh.nodejsHelperOptions.instance_id + '_' + lhinst.chat_id : 'chat_' + lhinst.chat_id), {'op':'vi_online', status: true});
        });

        sampleChannel.watch(function (op) {
            if (op.op == 'ot') { // Operator Typing Message
                var instStatus = $('#id-operator-typing');
                if (op.data.status == true) {
                    instStatus.text(op.data.ttx);
                    instStatus.css('visibility','visible');
                } else {
                    instStatus.css('visibility','hidden');
                }
            } else if (op.op == 'cmsg') {
                lhinst.syncusercall();
            } else if (op.op == 'schange') {
                lhinst.chatsyncuserpending();
                lhinst.syncusercall();
            } else if (op.op == 'vo') {
                 socket.publish((lh.nodejsHelperOptions.instance_id > 0 ? 'chat_'+lh.nodejsHelperOptions.instance_id+'_'+lhinst.chat_id : 'chat_'+lhinst.chat_id) ,{'op':'vi_online', status: true});
            }
        });

        // Disable default method
        LHCCallbacks.initTypingMonitoringUserInform = true;

        ee.addListener('visitorTyping', visitorTypingListener);
        ee.addListener('visitorTypingStopped', visitorTypingStoppedListener);

        // Make larger sync interval
        confLH.chat_message_sinterval = 10000;

        // Force one time check
        lhinst.syncusercall();
    }

    socket.on('connect', function (status) {
        if (status.isAuthenticated && lhinst.chat_id > 0) {
            connectVisitor();
        } else {
            socket.emit('login', {hash:lh.nodejsHelperOptions.hash, chanelName: chanelName}, function (err) {
                if (err) {
                    console.log(err);
                } else {
                    connectVisitor();
                }
            });
        }
    });

    $(window).on('beforeunload', function () {
        socket.destroy();
    });

},1000);
