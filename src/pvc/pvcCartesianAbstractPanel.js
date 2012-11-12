
def
.type('pvc.CartesianAbstractPanel', pvc.PlotPanel)
.init(function(chart, parent, plot, options) {
    
    // Prevent the border from affecting the box model,
    // providing a static 0 value, independently of the actual drawn value...
    //this.borderWidth = 0;
    
    this.base(chart, parent, plot, options);
    
    var axes = this.axes;
    
    function addAxis(axis){
        axes[axis.type] = axis;
        
        // TODO: are these really needed??
        axes[axis.orientedId] = axis;
        if(axis.v1SecondOrientedId){
            axes[axis.v1SecondOrientedId] = axis;
        }
    }
    
    addAxis(chart.getAxis('base',  plot.option('BaseAxis' ) - 1));
    addAxis(chart.getAxis('ortho', plot.option('OrthoAxis') - 1));
    
    // ----------------
    
    // Initialize paddings from **chart** axes offsets
    // TODO: move this to the chart??
    // TODO: and generalize on any axis (among base and ortho)
    var paddings = {};
    var hasAny = false;
    
    function setSide(side, pct){
        var value = paddings[side];
        if(value == null || pct > value){
            hasAny = true;
            paddings[side] = pct;
        }
    }
    
    function processAxis(axis){
        var offset = axis && axis.option('Offset');
        if(offset != null && offset > 0 && offset < 1) {
            if(axis.orientation === 'x'){
                setSide('left',  offset);
                setSide('right', offset);
            } else {
                setSide('top',    offset);
                setSide('bottom', offset);
            }
        }
    }
    
    var chartAxes = chart.axes;
    processAxis(chartAxes.x);
    processAxis(chartAxes.secondX);
    processAxis(chartAxes.y);
    processAxis(chartAxes.secondY);
    
    if(hasAny){
        this.offsetPaddings = paddings;
    }
})
.add({
    
    offsetPaddings: null,
    
    _calcLayout: function(layoutInfo){
        layoutInfo.requestPaddings = this._calcRequestPaddings(layoutInfo);
    },
    
    _calcRequestPaddings: function(layoutInfo){
        var op = this.offsetPaddings;
        if(!op){
            return;
        }

        var rp = this.chart._getAxesRoundingPaddings();
        var clientSize = layoutInfo.clientSize;
        var paddings   = layoutInfo.paddings;
        
        var reqPad = {};
        pvc.Sides.names.forEach(function(side){
            var len_a = pvc.BasePanel.orthogonalLength[side];
            
            var clientLen = clientSize[len_a];
            var paddingLen = paddings[len_a];
            
            var len = clientLen + paddingLen;
            
            var offset   = len * (op[side] || 0);
            var rounding = clientLen * (rp[side] || 0);
        
            reqPad[side] = Math.max(offset - rounding, 0);
        }, this);
        
        return reqPad;
    },
    
    /**
     * @override
     */
    _createCore: function() {
        // Send the panel behind the axis, title and legend, panels
        this.pvPanel.zOrder(-10);

        // Overflow
        var hideOverflow =
            def
            .query(['ortho', 'base'])
            .select(function(axisType) { return this.axes[axisType]; }, this)
            .any(function(axis){
                return axis.option('FixedMin') != null ||
                       axis.option('FixedMax') != null;
            });
        
        if (hideOverflow){
            // Padding area is used by bubbles and other vizs without problem
            this.pvPanel.borderPanel.overflow("hidden");
        }
    },
    
    _getVisibleData: function(){
        return this.chart._getVisibleData(this.dataPartValue);
    },

    /*
     * @override
     */
    _detectDatumsUnderRubberBand: function(datumsByKey, rb, keyArgs){
        // TODO: this is done for x and y axis only, which is ok for now,
        // as only discrete axes use selection and
        // multiple axis are only continuous...
        var any = false,
            chart = this.chart,
            xAxisPanel = chart.xAxisPanel,
            yAxisPanel = chart.yAxisPanel,
            xDatumsByKey,
            yDatumsByKey;

        //1) x axis
        if(xAxisPanel){
            xDatumsByKey = {};
            if(!xAxisPanel._detectDatumsUnderRubberBand(xDatumsByKey, rb, keyArgs)) {
                xDatumsByKey = null;
            }
        }

        //2) y axis
        if(yAxisPanel){
            yDatumsByKey = {};
            if(!yAxisPanel._detectDatumsUnderRubberBand(yDatumsByKey, rb, keyArgs)) {
                yDatumsByKey = null;
            }
        }

        // Rubber band selects on both axes?
        if(xDatumsByKey && yDatumsByKey) {
            // Intersect datums

            def.eachOwn(yDatumsByKey, function(datum, key){
                if(def.hasOwn(xDatumsByKey, key)) {
                    datumsByKey[datum.key] = datum;
                    any = true;
                }
            });

            keyArgs.toggle = true;

            // Rubber band selects over any of the axes?
        } else if(xDatumsByKey) {
            def.copy(datumsByKey, xDatumsByKey);
            any = true;
        } else if(yDatumsByKey) {
            def.copy(datumsByKey, yDatumsByKey);
            any = true;
        } else {
            // Ask the base implementation for datums
            any = this.base(datumsByKey, rb, keyArgs);
        }

        return any;
    }
});