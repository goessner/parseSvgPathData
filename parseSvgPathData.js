/**
 * parseSvgPathData (c) 2018 Stefan Goessner
 * SVG Path Data Micro Parser
 * @license MIT License
 * @link https://github.com/goessner/parseSvgPathData
 */
"use strict";

function parseSvgPathData(data,ifc,ctx) {
    const rex = /([achlmqstvz])([^achlmqstvz]*)/ig;
    const seg = { A:{n:7,f:'A'}, C:{n:6,f:'C'}, H:{n:1,f:'H'},
                  L:{n:2,f:'L'}, M:{n:2,f:'L'}, Q:{n:4,f:'Q'},
                  S:{n:4,f:'S'}, T:{n:2,f:'T'}, V:{n:1,f:'V'},
                  Z:{n:0},
                  a:{n:7,f:'a'}, c:{n:6,f:'c'}, h:{n:1,f:'h'},
                  l:{n:2,f:'l'}, m:{n:2,f:'l'}, q:{n:4,f:'q'},
                  s:{n:4,f:'s'}, t:{n:2,f:'t'}, v:{n:1,f:'v'},
                  z:{n:0} };

    const segment = (ifc,type,args) => {
        if (type in seg) {
            if (args.length === seg[type].n) {
                ifc[type](...args);
            }
            else if (args.length > seg[type].n) {
                ifc[type](...args);
                args.splice(0,seg[type].n);
                segment(ifc,seg[type].f,args);
            }
            else
                console.error(`invalid # of path segment '${type}' arguments: ${args.length} of ${seg[type].n}: '${args}'`)
        }
    };
    let match;

    if (!ifc) ifc = parseSvgPathData.defaultIfc;
    ifc.init(ctx);
        // for each explicit named segment ...
    while (match = rex.exec(data)) {
        segment(ifc, match[1], match[2].replace(/^\s+|\s+$/g,'')  // trim whitespace at both ends 
                                       .split(/[, \t\n\r]+/g)     // ... use str.trim() in future
                                       .map(Number))
    }
    return ifc.ctx;
}

// simplify segments to minimal absolute set [A,M,L,C] as JSON array
parseSvgPathData.defaultIfc = {
    init() { this.x=this.x0=this.y=this.y0=this.ctx.length = 0; },
    A(rx,ry,rot,fA,fS,x,y) { this.ctx.push({type:'A',x:(this.x=x),y:(this.y=y),rx,ry,rot,fA,fS}) },
    M(x,y) { this.ctx.push({type:'M',x:(this.x=this.x0=x),y:(this.y=this.y0=y)}) },
    L(x,y) { this.ctx.push({type:'L',x:(this.x=x),y:(this.y=y)}) },
    H(x) { this.ctx.push({type:'L',x:(this.x=x),y:this.y}) },
    V(y) { this.ctx.push({type:'L',x:this.x,y:(this.y=y)}) },
    C(x1,y1,x2,y2,x,y) { 
        this.ctx.push({type:'C',x:(this.x=x),y:(this.y=y),
                                x1:(this.x1=x1),y1:(this.y1=y1),
                                x2:(this.x2=x2),y2:(this.y2=y2)});
    },
    S(x2,y2,x,y) { 
        this.ctx.push({type:'C',x:(this.x=x),y:(this.y=y),
                                x1:(this.x1=2*this.x-this.x2),y1:(this.y1=2*this.y-this.y2),
                                x2:(this.x2=x2),y2:(this.y2=y2)});
    },
    Q(x1,y1,x,y) { 
        this.ctx.push({type:'C',x:(this.x=x),y:(this.y=y),
                                x1:(this.x1=x1),y1:(this.y2=y1),
                                x2:(this.x2=x1),y2:(this.y2=y2)});
    },
    T(x,y) { 
        this.ctx.push({type:'C',x:(this.x=x),y:(this.y=y),
                                x1:(this.x1+=2*(this.x-this.x1)),y1:(this.y1+=2*(this.y-this.y1)),
                                x2:(this.x2=x1),y2:(this.y2=y2)});
    },
    Z() { this.ctx.push({type:'L',x:(this.x=this.x0),y:(this.y=this.y0)}) },
    a(rx,ry,rot,fA,fS,x,y) { this.A(rx,ry,rot,fA,fS,this.x+x,this.y+y) },
    m(x,y) { this.M(this.x+x,this.y+y) },
    l(x,y) { this.L(this.x+x,this.y+y) },
    h(x) { this.H(this.x+x) },
    v(y) { this.V(this.y+y) },
    c(x1,y1,x2,y2,x,y) { this.C(this.x1+x1,this.y1+y1,this.x2+x2,this.y2+y2,this.x+x,this.y+y) },
    s(x2,y2,x,y) { this.S(this.x2+x2,this.y2+y2,this.x+x,this.y+y) },
    q(x1,y1,x,y) { this.Q(this.x1+x1,this.y1+y1,this.x+x,this.y+y) },
    t(x,y) { this.T(this.x+x,this.y+y) },
    z() { this.Z() },
    x0:0,y0:0, x:0,y:0, x1:0,y1:0, x2:0,y2:0,
    ctx:[]
};

// direct to CanvasRenderingContext2D interface or to a Path2D object
parseSvgPathData.canvasIfc = {
    init(ctx) { 
        this.x=this.x0=this.x1=this.x2=this.y=this.y0=this.y1=this.y2 = 0;
        this.ctx = ctx 
    },
    A(rx,ry,rot,fA,fS,x,y) {
        let x12 = x-this.x, y12 = y-this.y,
            phi = rot/180*Math.PI,
            cp = phi ? Math.cos(phi) : 1, sp = phi ? Math.sin(phi) : 0,
            k = ry/rx,
            dth_sgn = fS ? 1 : -1,
            Nx = dth_sgn*(-x12*cp - y12*sp), Ny = dth_sgn*(-x12*sp + y12*cp),
            NN = Math.hypot(Nx, Ny/k),
            R = 2*rx > NN ? rx : NN/2, // scale R to a valid value...
            dth = 2*dth_sgn*Math.asin(NN/2/R),
            th1, ct, st;

        if (fA) 
            dth = dth > 0 ? 2*Math.PI - dth : -2*Math.PI - dth;
        th1 = Math.atan2(k*Nx,Ny) - dth/2,
        ct = Math.cos(th1); st = Math.sin(th1);

        this.ctx.ellipse(
            this.x - R*(cp*ct - sp*k*st),
            this.y - R*(sp*ct + cp*k*st),
            R, R*k, phi, th1, th1 + dth, dth_sgn === -1
        )
        this.x = x; this.y = y;
    },
    M(x,y) { this.ctx.moveTo(this.x=this.x0=x, this.y=this.y0=y) },
    L(x,y) { this.ctx.lineTo(this.x=x, this.y=y) },
    H(x)   { this.ctx.lineTo(this.x=x, this.y  ) },
    V(y)   { this.ctx.lineTo(this.x,   this.y=y) },
    C(x1,y1,x2,y2,x,y) {
        this.ctx.bezierCurveTo(this.x1=x1,this.y1=y1,this.x2=x2,this.y2=y2,this.x=x,this.y=y)
    },
    S(x2,y2,x,y) {
        this.ctx.bezierCurveTo(this.x1=2*this.x-this.x1,this.y1=2*this.y-this.y1,
                               this.x2=x2,this.y2=y2,this.x=x,this.y=y)
    },
    Q(x1,y1,x,y) { 
        this.ctx.quadraticCurveTo(this.x1=x1,this.y1=y1,this.x=x,this.y=y) 
    },
    T(x,y) { 
        this.ctx.quadraticCurveTo(this.x1+=2*(this.x-this.x1),this.y1+=2*(this.y-this.y1),
                                  this.x=x,this.y=y) 
    },
    Z() { this.ctx.closePath() },
    a(rx,ry,rot,fA,fS,x,y) { this.A(rx,ry,rot,fA,fS,this.x+x,this.y+y) },
    m(x,y) { this.M(this.x+x,this.y+y) },
    l(x,y) { this.L(this.x+x,this.y+y) },
    h(x) { this.H(this.x+x) },
    v(y) { this.V(this.y+y) },
    c(x1,y1,x2,y2,x,y) { this.C(this.x1+x1,this.y1+y1,this.x2+x2,this.y2+y2,this.x+x,this.y+y) },
    s(x2,y2,x,y) { this.S(this.x2+x2,this.y2+y2,this.x+x,this.y+y) },
    q(x1,y1,x,y) { this.Q(this.x1+x1,this.y1+y1,this.x+x,this.y+y) },
    t(x,y) { this.T(this.x+x,this.y+y) },
    z() { this.Z() },
    // current point buffers (start, current, control)
    x0:0,y0:0, x:0,y:0, x1:0,y1:0, x2:0,y2:0,
    ctx
};
