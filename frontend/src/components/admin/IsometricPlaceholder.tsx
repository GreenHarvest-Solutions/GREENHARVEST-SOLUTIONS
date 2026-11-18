import React from 'react';

// A utility to convert 3D coordinates (x, y, z) to 2D isometric coordinates
const iso = (x: number, y: number, z: number) => {
  // X axis: down-right
  // Y axis: down-left
  // Z axis: up
  const screenX = (x - y) * 1; 
  const screenY = (x + y) * 0.5 - z;
  return { x: screenX, y: screenY };
};

interface IsoBlockProps {
  x: number;
  y: number;
  z: number;
  w: number; // size along X axis
  d: number; // size along Y axis
  h: number; // size along Z axis (height)
  topColor: string;
  leftColor: string;
  rightColor: string;
}

function IsoBlock({ x, y, z, w, d, h, topColor, leftColor, rightColor }: IsoBlockProps) {
  // 8 corners of the block
  const pTop0 = iso(x, y, z + h);
  const pTopX = iso(x + w, y, z + h);
  const pTopY = iso(x, y + d, z + h);
  const pTopXY = iso(x + w, y + d, z + h);

  const pBot0 = iso(x, y, z);
  const pBotX = iso(x + w, y, z);
  const pBotY = iso(x, y + d, z);
  const pBotXY = iso(x + w, y + d, z);

  // Top Face (Top0 -> TopX -> TopXY -> TopY)
  const topPath = `M ${pTop0.x} ${pTop0.y} L ${pTopX.x} ${pTopX.y} L ${pTopXY.x} ${pTopXY.y} L ${pTopY.x} ${pTopY.y} Z`;
  
  // Right Face (along X axis): (Top0 -> Bot0 -> BotX -> TopX) wait, if Y is down-left, X is down-right.
  // The faces visible are usually Top, Right (facing +X), Left (facing +Y)
  // Let's see: X goes down-right. So the face on the right is the one extending along X axis.
  // Right face: TopX -> BotX -> BotXY -> TopXY
  const rightPath = `M ${pTopX.x} ${pTopX.y} L ${pBotX.x} ${pBotX.y} L ${pBotXY.x} ${pBotXY.y} L ${pTopXY.x} ${pTopXY.y} Z`;

  // Left Face (along Y axis): (TopY -> BotY -> BotXY -> TopXY)
  const leftPath = `M ${pTopY.x} ${pTopY.y} L ${pBotY.x} ${pBotY.y} L ${pBotXY.x} ${pBotXY.y} L ${pTopXY.x} ${pTopXY.y} Z`;

  return (
    <g>
      <path d={leftPath} fill={leftColor} />
      <path d={rightPath} fill={rightColor} />
      <path d={topPath} fill={topColor} />
    </g>
  );
}

function IsoSphere({ x, y, z, r, color }: { x: number; y: number; z: number; r: number; color: string }) {
  const center = iso(x, y, z + r);
  return (
    <g>
      <defs>
        <radialGradient id={`grad-${color}`} cx="30%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.8" />
          <stop offset="100%" stopColor={color} />
        </radialGradient>
      </defs>
      <circle cx={center.x} cy={center.y} r={r} fill={`url(#grad-${color})`} />
    </g>
  );
}

export function IsometricIllustration() {
  // Colors from the image:
  // Pink: top: #ff99cc, left: #ff66a3, right: #ff80b3
  // Blue: top: #99c2ff, left: #4d94ff, right: #66a3ff
  // Purple: top: #b366ff, left: #7a00e6, right: #9933ff
  // Yellow: top: #ffdb4d, left: #cca300, right: #e6b800

  // The staircase moves along the Y and X axes.
  // Let's make block 1 (Pink) at (0, 0, 0)
  // Block 2 (Blue) at (-W, -D, H)
  // Block 3 (Purple) at (-2W, -2D, 2H)

  const w = 60;
  const d = 60;
  const h = 40;

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <svg viewBox="-250 -250 500 500" className="w-full h-full drop-shadow-2xl overflow-visible">
        <style>{`
          @keyframes float-fast {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-10px); }
          }
          @keyframes float-slow {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-15px); }
          }
          .floating-1 { animation: float-fast 4s ease-in-out infinite; }
          .floating-2 { animation: float-slow 5s ease-in-out infinite; }
          .floating-3 { animation: float-fast 6s ease-in-out infinite; }
        `}</style>
        
        {/* We must render from back to front to get the correct z-index in SVG */}
        <g className="floating-2">
          {/* Top Block (Purple) */}
          <IsoBlock 
            x={-120} y={-120} z={0} w={w} d={d} h={h} 
            topColor="#c084fc" leftColor="#9333ea" rightColor="#a855f7" 
          />
          {/* Orange Sphere on top of Purple */}
          <IsoSphere x={-90} y={-90} z={h} r={12} color="#f59e0b" />
        </g>

        <g className="floating-1">
          {/* Middle Block (Blue) */}
          <IsoBlock 
            x={-60} y={-60} z={-60} w={w} d={d} h={h} 
            topColor="#93c5fd" leftColor="#3b82f6" rightColor="#60a5fa" 
          />
          {/* White Sphere on top of Blue */}
          <IsoSphere x={-30} y={-30} z={h-60} r={12} color="#f8fafc" />
        </g>

        <g className="floating-3">
          {/* Bottom Block (Pink) */}
          <IsoBlock 
            x={0} y={0} z={-120} w={w} d={d} h={h} 
            topColor="#f9a8d4" leftColor="#ec4899" rightColor="#f472b6" 
          />
          {/* White Sphere on top of Pink */}
          <IsoSphere x={30} y={30} z={h-120} r={12} color="#f8fafc" />
        </g>

        {/* Floating Flat Squares (White) */}
        <g className="floating-1">
          <IsoBlock 
            x={60} y={-120} z={-30} w={40} d={40} h={4} 
            topColor="#ffffff" leftColor="#f1f5f9" rightColor="#e2e8f0" 
          />
        </g>
        <g className="floating-2">
          <IsoBlock 
            x={20} y={-160} z={-80} w={30} d={30} h={4} 
            topColor="#ffffff" leftColor="#f1f5f9" rightColor="#e2e8f0" 
          />
        </g>

      </svg>
    </div>
  );
}

export function SmallIsometricIcon({ type = 'purple' }: { type?: 'purple' | 'blue' | 'pink' }) {
  const colors = {
    purple: { top: '#c084fc', left: '#9333ea', right: '#a855f7' },
    blue: { top: '#93c5fd', left: '#3b82f6', right: '#60a5fa' },
    pink: { top: '#f9a8d4', left: '#ec4899', right: '#f472b6' }
  }[type];

  return (
    <div className="w-full h-full flex items-center justify-center">
      <svg viewBox="-30 -30 60 60" className="w-full h-full overflow-visible">
         <IsoBlock 
            x={-15} y={-15} z={-10} w={30} d={30} h={20} 
            topColor={colors.top} leftColor={colors.left} rightColor={colors.right} 
          />
      </svg>
    </div>
  );
}
