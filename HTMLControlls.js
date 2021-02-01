var HTMLControlls = {
    
    rand_int: function (min, max) {
        return min + Math.floor((max - min) * Math.random());
    },

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
    lastScene: function () {
        $('#loader').css('opacity', '0');
        $('.container').css('display', 'block');
    },
    endScene: function () {
        $('#loader').remove();
        $('.container').css({
            'opacity': '1',
             'display': 'block'
        });
        $('.footer').css({
            'display': 'block'
        });
        
        $('div#promp').css('opacity', '1');
        $('.resol').css('display', 'none');
        $('#play').css('display', 'none');
        $('#mute').css('display', 'none');
    },
    mobileIcon: function () {
    },
    rand_rotate: function () {
        $('#loader').css('filter', 'hue-rotate(' + this.rand_int(1, 360) + 'deg)');
    },
    controls: function () {
        $('.controls').css('opacity', '0.5');
    },
    res_check: function () {
        let url = window.location.href;
        if (url.indexOf('?r=1') !== -1) {
            $(".blue").addClass("selected");
        } else if (url.indexOf('?r=2') !== -1) {
            $(".yellow").addClass("selected");
        } else if (url.indexOf('?r=3') !== -1) {
            $(".red").addClass("selected");
        } else {
            $(".red").addClass("selected");
        }
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

function res_loc(par){
    par = parseInt(par);
    if(par === 1 || par === 2 || par === 3 ){
        window.location.href = window.location.origin + '/?r=' + par;
    }
}
