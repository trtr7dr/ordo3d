<!DOCTYPE html>
<html lang=" {{ trans('app.loc') }}" id="app">
    <head>
        <meta charset="utf-8">
        <title>{{ trans('app.title') }}</title>
        <meta name="csrf-token" content="{{ csrf_token() }}" />
        <meta name="description" value="{{ trans('app.title_alt') }}">
        <meta name="keywords" value="{{ trans('app.title_alt') }}, {{ trans('app.atr_chi') }}, {{ trans('app.atr_num') }}">
        <meta name="viewport" content="width=device-width, initial-scale=1.0"> 
        <link rel="shortcut icon" href="{{asset('assets/icon.ico')}}" type="image/x-icon">
        <link rel="stylesheet" href="{{asset('/css/menu.css')}}">
        <link rel="stylesheet" href="{{asset('/css/ordo.css')}}">
        <link rel="stylesheet" href="{{asset('css/bootstrap/css/bootstrap.css')}}">
        <style>
            #wrapper {
                position: absolute;
                width: 100%;
                height: 100%;
                display: flex;
                align-items: center;
                justify-content: center;
                background-color: #000;
            }
            canvas {
                display: block;
                width: 100%;
                height: 100vh;
            }
            #wrd{
                display: none;
            }
            #container{
                height: 100vh;
            }
        </style>
    </head>
    <body>
        @include('site.layouts.menu')
        <div id="container" ></div>

        
        <video id="wrd" loop="" muted="" autoplay="" class="fullscreen-bg__video">
            <source src="assets/3d/models/wrd.mp4" type="video/mp4">
        </video>
        
        <script type="x-shader/x-vertex" id="vertexshader">
            uniform float amplitude;
            attribute float displacement;
            varying vec3 vNormal;
            varying vec2 vUv;
            void main() {
            vNormal = normal;
            vUv = ( 0.5 + amplitude ) * uv + vec2( amplitude );
            vec3 newPosition = position + amplitude * normal * vec3( displacement );
            gl_Position = projectionMatrix * modelViewMatrix * vec4( newPosition, 1.0 );
            }
        </script>
        <script type="x-shader/x-fragment" id="fragmentshader">
            varying vec3 vNormal;
            varying vec2 vUv;
            uniform vec3 color;
            uniform sampler2D colorTexture;
            void main() {
            vec3 light = vec3( 0.5, 0.2, 1.0 );
            light = normalize( light );
            float dProd = dot( vNormal, light ) * 0.5 + 0.5;
            vec4 tcolor = texture2D( colorTexture, vUv );
            vec4 gray = vec4( vec3( tcolor.r * 0.3 + tcolor.g * 0.59 + tcolor.b * 0.11 ), 1.0 );
            gl_FragColor = gray * vec4( vec3( dProd ) * vec3( color ), 1.0 );
            }
        </script>
        <script id="fragShader" type="shader-code">
            uniform vec2 resolution;
            void main() {
            vec2 pos = gl_FragCoord.xy / resolution.xy;
            gl_FragColor = vec4(1.0,pos.x,pos.y,1.0);
            }
        </script>

        <script src="{{asset('js/jquery-3.2.1.min.js')}}"></script>
        <script src="{{asset('js/jquery.ba-dotimeout.min.js')}}"></script>
        <script src="{{asset('js/3d/script.js')}}" type="module"></script>
        <script src="{{asset('js/3d/HTMLControlls.js')}}"></script>

    </body>
</html>
