var HTMLControlls = {
    gltfReady: function () {
        $('#preload').remove();
        $('#container').css('opacity', 1);
        $('#play').css('opacity', '0.5');
        $('#wsda').css('opacity', '0.5');
        $('.controls').css('opacity', '1');
        $('#dis').css({
            'opacity': '0.5',
            'width': '10%',
            'margin-left': '1%' 
        });
        $('.loader').remove();
    },
    res_param_get: function () {
        let url = window.location.href;
        let res = 1;
        if (url.indexOf('?r=1') !== -1) {
            res = 4;
        } else if (url.indexOf('?r=2') !== -1) {
            res = 2;
        } else if (url.indexOf('?r=3') !== -1) {
            res = 1;
            $(".red").addClass("selected");
        } else {
            res = 1;
        }
        return res;
    },
    outline: function(flag) {
        if(flag){
            $('#container').css('cursor', 'pointer');
        }else{
            $('#container').css('cursor', 'default');
        }
    }

};

$(document).ready(function () {
    $('.selector > .selection').click(function (e) {
        $(this).siblings().removeClass('selected');
        $(this).addClass('selected');
    });
});
