/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*global pvc_ValueLabelVar:true */

def
.type('pvc.TreemapPanel', pvc.PlotPanel)
.init(function(chart, parent, plot, options){
    
    this.base(chart, parent, plot, options);
    
    this.axes.size = chart._getAxis('size', (plot.option('SizeAxis') || 0) - 1); // may be undefined

    this.visualRoles.size = chart.visualRole(plot.option('SizeRole'));
    
    this.layoutMode = plot.option('LayoutMode');
})
.add({
    _createCore: function(layoutInfo) {
        var me = this;
        var cs = layoutInfo.clientSize;
        var rootScene = me._buildScene();
        if(!rootScene) { return; } // Everything hidden
        
        var lw0 = def.number.to(me._getConstantExtension('leaf', 'lineWidth'), 1);
        var lw  = lw0;
        var lw2 = lw/2;
        
        var sizeProp = me.visualRoles.size.isBound() ?
                       // Does not use sceneScale on purpose because of the 'nullToZero'
                       // code not calling the base scale when null.
                       // The base scale already handles the null case, 
                       // translating it to the minimum value.
                       me.axes.size.scale.by1(function(scene) { return scene.vars.size.value; }) :
                       100;
                
        var panel = me.pvTreemapPanel = new pvc.visual.Panel(me, me.pvPanel, {
                panelType:   pv.Layout.Treemap,
                extensionId: 'panel'
            })
            .pvMark
            .lock('visible', true)
            .lock('nodes',   rootScene.nodes())
            // Reserve space for interaction borders
            .lock('left',    lw2)
            .lock('top',     lw2)
            .lock('width',   cs.width  - lw)
            .lock('height',  cs.height - lw)
            .lock('size',    sizeProp)
            .lock('mode',    me.layoutMode)
            .lock('order',   null) // TODO: option for this?
            .lock('round',   false);
        
        // Node prototype
        // Reserve space for interaction borders
        panel.node
            .left  (function(n) { return n.x  + lw2; })
            .top   (function(n) { return n.y  + lw2; })
            .width (function(n) { return n.dx - lw;  })
            .height(function(n) { return n.dy - lw;  });
        
        // ------------------
        
        var colorAxis = me.axes.color;
        var colorScale;
        if(me.visualRoles.color.isBound()) {
            colorScale = colorAxis.sceneScale({sceneVarName: 'color'});
        } else {
            colorScale = def.fun.constant(colorAxis.option('Unbound'));
        }
        
        // ------------------
        
        var pvLeafMark = new pvc.visual.Bar(me, panel.leaf, {extensionId: 'leaf'})
            .lockMark('visible')
            .override('defaultColor', function(scene) {
                return colorScale(scene);
            })
            .override('defaultStrokeWidth', function() { return lw0; })
            .pvMark
            .antialias(false)
            .lineCap('round') // only used by strokeDashArray
            .strokeDasharray(function(scene) {
                return scene.vars.size.value < 0 ? 'dash' : null; // Keep this in sync with the style in pvc.sign.DotSizeColor
            });
       
        new pvc.visual.Bar(me, panel.node, {
            extensionId: 'ascendant',
            noHover:  true,
            noSelect: true,
            noClick:  true,
            noDoubleClick:  true
        })
        .intercept('visible', function(scene) {
            return !!scene.parent && 
                   !!scene.firstChild &&
                   this.delegateExtension(true); 
         })
        .override('anyInteraction', function(scene) {
            return scene.anyInteraction() ||
                   scene.isActiveDescendantOrSelf(); // special kind of interaction
        })
        .override('defaultStrokeWidth', function() { return 1.5 * lw; })
        .override('interactiveStrokeWidth', function(scene, w) {
            if(this.showsActivity() && scene.isActiveDescendantOrSelf()) {
               w = Math.max(1, w) * 1.5;
            }
            return w;
        })
        .override('defaultColor',     function(scene) { return colorScale(scene); })
        .override('normalColor',      def.fun.constant(null))
        .override('interactiveColor', function(scene, color, type) {
            if(type === 'stroke') {
                if(this.showsActivity()) {
                    if(scene.isActiveDescendantOrSelf()) {
                        return pv.color(color).brighter(0.5)/*.alpha(0.7)*/;
                    }
                    
                    if(scene.anyActive()) { return null; }
               }
                
               if(this.showsSelection() && scene.isSelectedDescendantOrSelf()) {
                   return pv.color(color).brighter(0.5)/*.alpha(0.7)*/;
               }
            }
            return null;
        })
        .pvMark
        .antialias(false);
        
        var label = pvc.visual.ValueLabel.maybeCreate(me, panel.label, {noAnchor: true});
        if(label) {
            label
            .optional('textAngle', function(scene) {
                // If it fits horizontally => horizontal.
                var text = this.defaultText(scene);
                if(scene.dx > pv.Text.measureWidth(text, scene.vars.font)) {
                    return 0;
                }

                // Else, orient it in the widest dimension.
                return scene.dx > scene.dy ? 0 : -Math.PI / 2; 
            })
            .intercept('visible', function(scene) {
                var visible = this.delegate();
                if(visible) {
                    // If the text height is too big for the space, hide.
                    var side = this.pvMark.textAngle() ? 'dx' : 'dy';
                    visible = (scene[side] >= pv.Text.fontHeight(scene.vars.font));
                }
                return visible;
            })
            .override('trimText', function(scene, text) {
                // Vertical/Horizontal orientation?
                var side = this.pvMark.textAngle() ? 'dy' : 'dx';
                
                // Add a small margin (2 px)
                var maxWidth = scene[side] - 2;
                return pvc.text.trimToWidthB(maxWidth, text, scene.vars.font, "..");
            })
            .override('calcBackgroundColor', function() {
                // Corresponding scene on pvLeafMark sibling mark (rendered before)
                var pvSiblingScenes = pvLeafMark.scene;
                var pvLeafScene     = pvSiblingScenes[this.pvMark.index];
                return pvLeafScene.fillStyle;
            });
        }
    },
    
    _getExtensionId: function(){
        // 'content' coincides, visually, with 'plot', in this chart type
        // Actually it shares the same panel...
        
        var extensionIds = [{abs: !this.chart.parent ? 'content' : 'smallContent'}];
        return extensionIds.concat(this.base());
    },
    
    renderInteractive: function(){
        this.pvTreemapPanel.render();
    },
    
    _buildScene: function() {
        // Hierarchical data, by categ1 (level1) , categ2 (level2), categ3 (level3),...
        var data = this.visibleData({ignoreNulls: false});

        // Everything hidden?
        if(!data.childCount()) { return null; }
        
        var roles = this.visualRoles;
        var rootScene = new pvc.visual.Scene(null, {panel: this, source: data});
        var sizeVarHelper = new pvc.visual.RoleVarHelper(rootScene, roles.size,  {roleVar: 'size',  allowNestedVars: true, hasPercentSubVar: true});
        var colorGrouping = roles.color && roles.color.grouping;
        var colorByParent = colorGrouping && this.plot.option('ColorMode') === 'byparent';
        
        var recursive = function(scene) {
            var group = scene.group;
            
            // The 'category' var value is the local group's value...
            // 
            // When all categories are flattened into a single level
            // of a data hierarchy, 
            // each data's local key is compatible to the role key
            // (the one obtained by using:
            // pvc.data.Complex.compositeKey(complex, role.dimensioNames())
            // That key will be the concatenation of the keys of all atoms 
            // (corresponding to the single level's dimensions).
            // If any of these keys is empty, the key will contain 
            // consecutive ~ separator characters, like "Foo~Bar~~Guru",
            // or even a trailing one: "Foo~Bar~Guru~".
            //
            // On the other hand, the key obtained by an abs key, at a given node,
            // will contain all the keys of ascendant nodes, but no *trailing* empty keys.
            // The keys of compositeKeys are like if all keys were obtained
            // at the leaves of a regular tree (all branches have the same depth).
            // When a leaf did not, in fact, exist, 
            // an empty data node would be placed there anyway, 
            // with an empty key.
            // 
            // The two keys cannot currently be made compatible because
            // it seems that the waterfall's DfsPre/DfsPost flattening
            // needs the distinction between the key of the ancestor,
            // and the key of the unexistent leaf under it...
            //
            // 
            
            // TODO: Should be the abs key (no trailing empty keys)
            scene.vars.category = pvc_ValueLabelVar.fromComplex(group);
            
            // All nodes are considered leafs, for what the var helpers are concerned
            sizeVarHelper.onNewScene(scene, /*isLeaf*/ true);
            
            // Ignore degenerate childs
            var children = group
                .children()
                .where(function(childData) { return childData.value != null; })
                .array();
                    
            if(!colorGrouping) {
                if(!scene.parent) { scene.vars.color = new pvc_ValueLabelVar(null, ""); }
            } else {
                // Leafs, in colorByParent, receive the parent's color.
                var colorGroup = (colorByParent && !children.length) ? group.parent : group;
                if(!colorGroup) {
                    scene.vars.color = new pvc_ValueLabelVar(null, "");
                } else {
                    var colorView = colorGrouping.view(colorGroup);
                    //scene.vars.color = pvc_ValueLabelVar.fromComplex(colorView); //
                    //scene.vars.color = new pvc_ValueLabelVar(colorGroup.absKey, colorGroup.absLabel);
                    scene.vars.color = new pvc_ValueLabelVar(
                        colorView.keyTrimmed(), 
                        colorView.label);
                    
                }
            }
            
            if(children.length) {
                children.forEach(function(childData) {
                    recursive(new pvc.visual.Scene(scene, {source: childData}));
                });
            }
            
            return scene;
        };
        
        return recursive(rootScene);
    }
});
