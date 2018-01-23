import Renderer from 'osgViewer/Renderer';
import View from 'osgViewer/View';
import Viewer from 'osgViewer/Viewer';
import EventProxy from 'osgViewer/eventProxy/eventProxy';
import Scene from 'osgViewer/Scene';
import Groups from 'osgViewer/input/InputConstants'


var osgViewer = {};

osgViewer.Renderer = Renderer;
osgViewer.View = View;
osgViewer.Viewer = Viewer;
osgViewer.EventProxy = EventProxy;
osgViewer.Scene = Scene;
osgViewer.InputGroups = Groups;

export default osgViewer;
