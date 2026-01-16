import React, { useState, useRef, Suspense, useCallback, useEffect, useMemo, Component, ErrorInfo, ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, Grid, Text, Html } from "@react-three/drei";
import * as THREE from "three";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Move,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Home,
  Sofa,
  BedDouble,
  Bath,
  CookingPot,
  Tv,
  Armchair,
  Table,
  Square,
  Box,
  Grid3X3,
  Download,
  Save,
  Eye,
  Layers,
  DoorOpen,
  ArrowUp,
  ArrowDown,
  ArrowLeftIcon,
  ArrowRightIcon,
  Video,
  Link2,
  Unlink,
  FileJson,
  Image,
  FileText,
  ChevronDown,
  ChevronRight,
  FolderPlus,
  Lock,
  Unlock,
  Undo,
  Redo,
  RotateCw,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";

interface Room {
  id: string;
  name: string;
  width: number;
  length: number;
  height: number;
  x: number;
  z: number;
  color: string;
  floor: number;
  rotation?: number; // 0, 90, 180, 270 degrees
  isStairs?: boolean;
  stairsDirection?: "up" | "down";
  connectedRoomId?: string;
  locked?: boolean;
}

interface HistoryState {
  rooms: Room[];
  doors: Door[];
  furniture: Furniture[];
}

interface Furniture {
  id: string;
  type: string;
  name: string;
  width: number;
  depth: number;
  height: number;
  x: number;
  z: number;
  rotation: number;
  color: string;
  roomId: string;
}

interface Door {
  id: string;
  roomId: string;
  wall: "north" | "south" | "east" | "west";
  position: number;
  width: number;
  connectedRoomId?: string;
}

type CameraView = "perspective" | "top";

interface WebGLErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class WebGLErrorBoundary extends Component<{ children: ReactNode }, WebGLErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): WebGLErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("WebGL Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-full bg-muted/50">
          <div className="text-center p-8">
            <div className="text-4xl mb-4">🖥️</div>
            <h3 className="text-lg font-semibold mb-2">3D View Unavailable</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Unable to create graphics context. This can happen when system resources are limited.
            </p>
            <button
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm"
              onClick={() => window.location.reload()}
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const ROOM_PRESETS = [
  { name: "Living Room", width: 15, length: 12, height: 9, color: "#e8e4e1", isStairs: false },
  { name: "Master Bedroom", width: 14, length: 12, height: 9, color: "#d4e5f7", isStairs: false },
  { name: "Master Bathroom", width: 10, length: 8, height: 9, color: "#c8e8dc", isStairs: false },
  { name: "Bedroom", width: 12, length: 10, height: 9, color: "#d4e5f7", isStairs: false },
  { name: "Kitchen", width: 12, length: 10, height: 9, color: "#f5e6d3", isStairs: false },
  { name: "Bathroom", width: 8, length: 6, height: 9, color: "#e0f0e8", isStairs: false },
  { name: "Closet", width: 6, length: 4, height: 9, color: "#e8dcd0", isStairs: false },
  { name: "Dining Room", width: 12, length: 10, height: 9, color: "#f0e8d0", isStairs: false },
  { name: "Office", width: 10, length: 10, height: 9, color: "#e8e8e8", isStairs: false },
  { name: "Hallway", width: 4, length: 15, height: 9, color: "#f5f5f5", isStairs: false },
  { name: "Landing", width: 6, length: 6, height: 9, color: "#d8d0c8", isStairs: false },
  { name: "Laundry Room", width: 8, length: 6, height: 9, color: "#f0f0f0", isStairs: false },
  { name: "Garage", width: 20, length: 20, height: 10, color: "#d0d0d0", isStairs: false },
  { name: "Stairs", width: 4, length: 10, height: 9, color: "#b8a090", isStairs: true },
];

const FURNITURE_TYPES = [
  { type: "sofa", name: "Sofa", width: 7, depth: 3, height: 3, icon: Sofa, color: "#8B4513" },
  { type: "armchair", name: "Armchair", width: 3, depth: 3, height: 3, icon: Armchair, color: "#A0522D" },
  { type: "bed_king", name: "King Bed", width: 6.5, depth: 6.5, height: 2, icon: BedDouble, color: "#DEB887" },
  { type: "bed_queen", name: "Queen Bed", width: 5, depth: 6.5, height: 2, icon: BedDouble, color: "#DEB887" },
  { type: "dining_table", name: "Dining Table", width: 6, depth: 3, height: 2.5, icon: Table, color: "#8B4513" },
  { type: "desk", name: "Desk", width: 5, depth: 2.5, height: 2.5, icon: Table, color: "#654321" },
  { type: "tv_stand", name: "TV Stand", width: 5, depth: 1.5, height: 2, icon: Tv, color: "#333333" },
  { type: "bathtub", name: "Bathtub", width: 5, depth: 2.5, height: 2, icon: Bath, color: "#FFFFFF" },
  { type: "toilet", name: "Toilet", width: 1.5, depth: 2.5, height: 2.5, icon: Bath, color: "#FFFFFF" },
  { type: "sink", name: "Sink", width: 2, depth: 1.5, height: 3, icon: Bath, color: "#FFFFFF" },
  { type: "stove", name: "Stove/Oven", width: 2.5, depth: 2.5, height: 3, icon: CookingPot, color: "#404040" },
  { type: "refrigerator", name: "Refrigerator", width: 3, depth: 2.5, height: 6, icon: Box, color: "#C0C0C0" },
  { type: "cabinet", name: "Cabinet", width: 3, depth: 2, height: 6, icon: Square, color: "#8B4513" },
];

function WallSegment({ start, end, height, thickness = 0.5 }: { start: [number, number]; end: [number, number]; height: number; thickness?: number }) {
  const length = Math.sqrt(Math.pow(end[0] - start[0], 2) + Math.pow(end[1] - start[1], 2));
  if (length < 0.1) return null;
  const angle = Math.atan2(end[1] - start[1], end[0] - start[0]);
  const midX = (start[0] + end[0]) / 2;
  const midZ = (start[1] + end[1]) / 2;

  return (
    <mesh position={[midX, height / 2, midZ]} rotation={[0, -angle, 0]}>
      <boxGeometry args={[length, height, thickness]} />
      <meshStandardMaterial color="#f5f5f5" />
    </mesh>
  );
}

function DoorFrame({ position, rotation, width, height }: { position: [number, number, number]; rotation: number; width: number; height: number }) {
  const frameThickness = 0.3;
  const doorThickness = 0.15;
  const doorHeight = height - 0.5;
  const doorWidth = width - 0.2;
  
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[-width / 2 - frameThickness / 2, height / 2, 0]}>
        <boxGeometry args={[frameThickness, height, 0.5]} />
        <meshStandardMaterial color="#654321" />
      </mesh>
      <mesh position={[width / 2 + frameThickness / 2, height / 2, 0]}>
        <boxGeometry args={[frameThickness, height, 0.5]} />
        <meshStandardMaterial color="#654321" />
      </mesh>
      <mesh position={[0, height - 0.15, 0]}>
        <boxGeometry args={[width + frameThickness * 2, 0.3, 0.5]} />
        <meshStandardMaterial color="#654321" />
      </mesh>
      <group position={[-width / 2 + 0.1, 0, 0]}>
        <group rotation={[0, Math.PI / 2, 0]}>
          <mesh position={[doorWidth / 2, doorHeight / 2 + 0.1, 0]}>
            <boxGeometry args={[doorWidth, doorHeight, doorThickness]} />
            <meshStandardMaterial color="#8B4513" />
          </mesh>
          <mesh position={[doorWidth - 0.3, doorHeight / 2, doorThickness / 2 + 0.08]}>
            <sphereGeometry args={[0.12, 16, 16]} />
            <meshStandardMaterial color="#C0A000" metalness={0.8} roughness={0.2} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

function Wall({ start, end, height, thickness = 0.5, doors = [] }: { 
  start: [number, number]; 
  end: [number, number]; 
  height: number; 
  thickness?: number;
  doors?: { position: number; width: number; renderFrame?: boolean }[];
}) {
  const wallLength = Math.sqrt(Math.pow(end[0] - start[0], 2) + Math.pow(end[1] - start[1], 2));
  const angle = Math.atan2(end[1] - start[1], end[0] - start[0]);
  const dx = (end[0] - start[0]) / wallLength;
  const dz = (end[1] - start[1]) / wallLength;

  if (doors.length === 0) {
    return <WallSegment start={start} end={end} height={height} thickness={thickness} />;
  }
  
  const sortedDoors = [...doors].sort((a, b) => a.position - b.position);
  const segments: React.ReactNode[] = [];
  const doorFrames: React.ReactNode[] = [];
  let currentPos = 0;

  sortedDoors.forEach((door, index) => {
    const doorStart = door.position - door.width / 2;
    const doorEnd = door.position + door.width / 2;

    if (currentPos < doorStart) {
      const segStart: [number, number] = [start[0] + dx * currentPos, start[1] + dz * currentPos];
      const segEnd: [number, number] = [start[0] + dx * doorStart, start[1] + dz * doorStart];
      segments.push(<WallSegment key={`seg-${index}-before`} start={segStart} end={segEnd} height={height} thickness={thickness} />);
    }

    const doorX = start[0] + dx * door.position;
    const doorZ = start[1] + dz * door.position;
    if (door.renderFrame !== false) {
      doorFrames.push(
        <DoorFrame 
          key={`door-${index}`} 
          position={[doorX, 0, doorZ]} 
          rotation={-angle} 
          width={door.width} 
          height={height} 
        />
      );
    }

    currentPos = doorEnd;
  });

  if (currentPos < wallLength) {
    const segStart: [number, number] = [start[0] + dx * currentPos, start[1] + dz * currentPos];
    segments.push(<WallSegment key="seg-final" start={segStart} end={end} height={height} thickness={thickness} />);
  }

  return <>{segments}{doorFrames}</>;
}

function RoomFloor({ room, doors }: { room: Room; doors: Door[] }) {
  const roomDoors = doors.filter(d => d.roomId === room.id);
  
  const getDoorsForWall = (wall: "north" | "south" | "east" | "west") => {
    const wallLength = wall === "north" || wall === "south" ? room.width : room.length;
    return roomDoors
      .filter(d => d.wall === wall)
      .map(d => {
        const isReversedWall = wall === "north" || wall === "east";
        const adjustedPosition = isReversedWall ? (wallLength - d.position) : d.position;
        const isPrimaryDoor = !d.connectedRoomId || d.roomId < d.connectedRoomId;
        return { position: adjustedPosition, width: d.width, renderFrame: isPrimaryDoor };
      });
  };

  const fontSize = Math.min(room.width, room.length) * 0.15;
  
  return (
    <group position={[room.x, 0.05, room.z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[room.width, room.length]} />
        <meshStandardMaterial color={room.color} />
      </mesh>
      <Text
        position={[0, 0.02, 0]}
        rotation={[-Math.PI / 2, 0, Math.PI]}
        fontSize={fontSize}
        color="#333333"
        anchorX="center"
        anchorY="middle"
        maxWidth={room.width * 0.9}
      >
        {room.name}
      </Text>
      <Wall 
        start={[-room.width / 2, -room.length / 2]} 
        end={[room.width / 2, -room.length / 2]} 
        height={room.height} 
        doors={getDoorsForWall("south")}
      />
      <Wall 
        start={[room.width / 2, -room.length / 2]} 
        end={[room.width / 2, room.length / 2]} 
        height={room.height}
        doors={getDoorsForWall("west")}
      />
      <Wall 
        start={[room.width / 2, room.length / 2]} 
        end={[-room.width / 2, room.length / 2]} 
        height={room.height}
        doors={getDoorsForWall("north")}
      />
      <Wall 
        start={[-room.width / 2, room.length / 2]} 
        end={[-room.width / 2, -room.length / 2]} 
        height={room.height}
        doors={getDoorsForWall("east")}
      />
    </group>
  );
}

function Stairs3D({ room }: { room: Room }) {
  const numSteps = 12;
  const stepHeight = room.height / numSteps;
  const stepDepth = room.length / numSteps;
  const stepWidth = room.width;
  const isGoingUp = room.stairsDirection === "up";
  
  if (isGoingUp) {
    const steps = [];
    for (let i = 0; i < numSteps; i++) {
      steps.push(
        <mesh
          key={i}
          position={[0, stepHeight * (i + 0.5), -room.length / 2 + stepDepth * (i + 0.5)]}
        >
          <boxGeometry args={[stepWidth - 0.2, stepHeight, stepDepth]} />
          <meshStandardMaterial color="#a08070" />
        </mesh>
      );
    }
    
    return (
      <group position={[room.x, 0, room.z]}>
        <mesh position={[-stepWidth / 2 - 0.1, room.height / 2, 0]}>
          <boxGeometry args={[0.2, room.height, room.length]} />
          <meshStandardMaterial color="#8b7355" />
        </mesh>
        <mesh position={[stepWidth / 2 + 0.1, room.height / 2, 0]}>
          <boxGeometry args={[0.2, room.height, room.length]} />
          <meshStandardMaterial color="#8b7355" />
        </mesh>
        {steps}
        <mesh position={[0, room.height, room.length / 2 - 0.5]}>
          <boxGeometry args={[stepWidth, 0.3, 1]} />
          <meshStandardMaterial color="#654321" />
        </mesh>
      </group>
    );
  } else {
    const steps = [];
    for (let i = 0; i < numSteps; i++) {
      steps.push(
        <mesh
          key={i}
          position={[0, -stepHeight * (i + 0.5), room.length / 2 - stepDepth * (i + 0.5)]}
        >
          <boxGeometry args={[stepWidth - 0.2, stepHeight, stepDepth]} />
          <meshStandardMaterial color="#705040" />
        </mesh>
      );
    }
    
    return (
      <group position={[room.x, 0, room.z]}>
        <mesh position={[-stepWidth / 2 - 0.1, -room.height / 2, 0]}>
          <boxGeometry args={[0.2, room.height, room.length]} />
          <meshStandardMaterial color="#5a4535" />
        </mesh>
        <mesh position={[stepWidth / 2 + 0.1, -room.height / 2, 0]}>
          <boxGeometry args={[0.2, room.height, room.length]} />
          <meshStandardMaterial color="#5a4535" />
        </mesh>
        {steps}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
          <planeGeometry args={[stepWidth, room.length]} />
          <meshStandardMaterial color="#4a3a2a" />
        </mesh>
        <mesh position={[0, 0, -room.length / 2 + 0.25]}>
          <boxGeometry args={[stepWidth + 0.4, 0.5, 0.5]} />
          <meshStandardMaterial color="#654321" />
        </mesh>
      </group>
    );
  }
}

function FurnitureItem({ furniture, isSelected, onClick }: { furniture: Furniture; isSelected: boolean; onClick: () => void }) {
  const meshRef = useRef<THREE.Mesh>(null);

  return (
    <mesh
      ref={meshRef}
      position={[furniture.x, furniture.height / 2, furniture.z]}
      rotation={[0, (furniture.rotation * Math.PI) / 180, 0]}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
    >
      <boxGeometry args={[furniture.width, furniture.height, furniture.depth]} />
      <meshStandardMaterial 
        color={furniture.color} 
        emissive={isSelected ? "#4444ff" : "#000000"}
        emissiveIntensity={isSelected ? 0.3 : 0}
      />
      {isSelected && (
        <Html center position={[0, furniture.height / 2 + 0.5, 0]}>
          <div className="bg-primary text-primary-foreground px-2 py-1 rounded text-xs whitespace-nowrap">
            {furniture.name}
          </div>
        </Html>
      )}
    </mesh>
  );
}

function CameraController({ view, rooms, resetTrigger }: { view: CameraView; rooms: Room[]; resetTrigger: number }) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const isAnimating = useRef(false);
  const lastView = useRef(view);
  const lastReset = useRef(resetTrigger);
  const hasInitialized = useRef(false);
  
  const centerX = rooms.length > 0 
    ? rooms.reduce((sum, r) => sum + r.x, 0) / rooms.length 
    : 0;
  const centerZ = rooms.length > 0 
    ? rooms.reduce((sum, r) => sum + r.z, 0) / rooms.length 
    : 0;
  
  const defaultPos = { x: 30, y: 30, z: 30 };
  
  // Only trigger animation on explicit view changes or reset, not on initial render
  if (hasInitialized.current && (lastView.current !== view || lastReset.current !== resetTrigger)) {
    isAnimating.current = true;
  }
  lastView.current = view;
  lastReset.current = resetTrigger;
  hasInitialized.current = true;
  
  useFrame(() => {
    if (!isAnimating.current) return;
    
    if (view === "top") {
      const targetY = 60;
      // Position camera directly above, slightly to the south so south appears at bottom
      camera.position.set(centerX, targetY, centerZ - 0.1);
      camera.lookAt(centerX, 0, centerZ);
      if (controlsRef.current) {
        controlsRef.current.target.set(centerX, 0, centerZ);
        controlsRef.current.update();
      }
      isAnimating.current = false;
    } else {
      camera.position.x += (defaultPos.x - camera.position.x) * 0.1;
      camera.position.y += (defaultPos.y - camera.position.y) * 0.1;
      camera.position.z += (defaultPos.z - camera.position.z) * 0.1;
      if (controlsRef.current) {
        controlsRef.current.target.lerp(new THREE.Vector3(0, 0, 0), 0.1);
      }
      const dist = Math.sqrt(
        Math.pow(camera.position.x - defaultPos.x, 2) +
        Math.pow(camera.position.y - defaultPos.y, 2) +
        Math.pow(camera.position.z - defaultPos.z, 2)
      );
      if (dist < 0.5) isAnimating.current = false;
    }
  });
  
  return (
    <OrbitControls 
      ref={controlsRef}
      makeDefault 
      minDistance={5} 
      maxDistance={100}
      maxPolarAngle={view === "top" ? Math.PI * 0.1 : Math.PI / 2 - 0.1}
      enableRotate={view !== "top"}
    />
  );
}

interface SceneRef {
  captureFromAngles: (centerX: number, centerZ: number) => Promise<string[]>;
}

const SceneCapture = React.forwardRef<SceneRef, { centerX: number; centerZ: number }>(
  function SceneCapture({ centerX, centerZ }, ref) {
    const { camera, gl, scene } = useThree();
    
    React.useImperativeHandle(ref, () => ({
      captureFromAngles: async (cx: number, cz: number) => {
        const captures: string[] = [];
        const distance = 45;
        const height = 30;
        
        const corners = [
          { name: "NE Corner", x: cx + distance, z: cz + distance },
          { name: "NW Corner", x: cx - distance, z: cz + distance },
          { name: "SE Corner", x: cx + distance, z: cz - distance },
          { name: "SW Corner", x: cx - distance, z: cz - distance },
        ];
        
        const originalPos = camera.position.clone();
        const originalTarget = new THREE.Vector3(0, 0, 0);
        
        for (const corner of corners) {
          camera.position.set(corner.x, height, corner.z);
          camera.lookAt(cx, 0, cz);
          camera.updateProjectionMatrix();
          
          gl.render(scene, camera);
          await new Promise(resolve => setTimeout(resolve, 100));
          gl.render(scene, camera);
          
          const dataUrl = gl.domElement.toDataURL("image/png");
          captures.push(dataUrl);
        }
        
        camera.position.copy(originalPos);
        camera.lookAt(originalTarget);
        camera.updateProjectionMatrix();
        gl.render(scene, camera);
        
        return captures;
      }
    }));
    
    return null;
  }
);

function Scene({ rooms, furniture, doors, selectedFurniture, onSelectFurniture, cameraView, resetTrigger, sceneRef }: {
  rooms: Room[];
  furniture: Furniture[];
  doors: Door[];
  selectedFurniture: string | null;
  onSelectFurniture: (id: string | null) => void;
  cameraView: CameraView;
  resetTrigger: number;
  sceneRef?: React.RefObject<SceneRef | null>;
}) {
  const centerX = rooms.length > 0 ? rooms.reduce((sum, r) => sum + r.x, 0) / rooms.length : 0;
  const centerZ = rooms.length > 0 ? rooms.reduce((sum, r) => sum + r.z, 0) / rooms.length : 0;
  
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 20, 10]} intensity={0.8} castShadow />
      <directionalLight position={[-10, 20, -10]} intensity={0.4} />
      
      <Grid
        args={[100, 100]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#6e6e6e"
        sectionSize={5}
        sectionThickness={1}
        sectionColor="#9d4b4b"
        fadeDistance={50}
        fadeStrength={1}
        position={[0, 0, 0]}
      />

      {rooms.map((room) => (
        room.isStairs ? (
          <Stairs3D key={room.id} room={room} />
        ) : (
          <RoomFloor key={room.id} room={room} doors={doors} />
        )
      ))}

      {furniture.map((item) => (
        <FurnitureItem
          key={item.id}
          furniture={item}
          isSelected={selectedFurniture === item.id}
          onClick={() => onSelectFurniture(item.id)}
        />
      ))}

      <CameraController view={cameraView} rooms={rooms} resetTrigger={resetTrigger} />
      <PerspectiveCamera makeDefault position={[30, 30, 30]} fov={50} />
      {sceneRef && <SceneCapture ref={sceneRef} centerX={centerX} centerZ={centerZ} />}
    </>
  );
}

function checkWebGLSupport(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    return !!gl;
  } catch (e) {
    return false;
  }
}

export default function FloorPlan3D() {
  const { currentPortal } = useAuth();
  const { toast } = useToast();
  
  const [webGLSupported, setWebGLSupported] = useState<boolean | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  
  useEffect(() => {
    setWebGLSupported(checkWebGLSupport());
  }, []);
  const [furniture, setFurniture] = useState<Furniture[]>([]);
  const [doors, setDoors] = useState<Door[]>([]);
  const [historyStack, setHistoryStack] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isUndoRedoAction, setIsUndoRedoAction] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [selectedRooms, setSelectedRooms] = useState<Set<string>>(new Set());
  const [selectedFurniture, setSelectedFurniture] = useState<string | null>(null);
  const [showAddRoomDialog, setShowAddRoomDialog] = useState(false);
  const [showAddDoorDialog, setShowAddDoorDialog] = useState(false);
  const [cameraView, setCameraView] = useState<CameraView>("perspective");
  const [cameraResetTrigger, setCameraResetTrigger] = useState(0);
  const [currentFloor, setCurrentFloor] = useState(1);
  const [totalFloors, setTotalFloors] = useState(1);
  const [newDoor, setNewDoor] = useState<{ wall: "north" | "south" | "east" | "west"; position: number; width: number; connectedRoomId?: string; snapConnectedRoom: boolean }>({
    wall: "south",
    position: 50,
    width: 3,
    connectedRoomId: undefined,
    snapConnectedRoom: true,
  });
  
  const [newRoom, setNewRoom] = useState({
    name: "",
    width: 12,
    length: 10,
    height: 9,
    color: "#e8e4e1",
  });
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [manualGroups, setManualGroups] = useState<{ id: string; name: string; roomIds: string[]; floor: number }[]>([]);
  const [showCreateGroupDialog, setShowCreateGroupDialog] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [addingToGroupRoomId, setAddingToGroupRoomId] = useState<string | null>(null);

  const dashboardPath = currentPortal === "admin" ? "/admin/dashboard" : "/contractor/dashboard";
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneRef = useRef<SceneRef | null>(null);

  const currentFloorRooms = rooms.filter(r => r.floor === currentFloor);
  const currentFloorGroups = manualGroups.filter(g => g.floor === currentFloor);
  
  const roomGroups = useMemo(() => {
    const groups: { id: string; name: string; rooms: Room[]; isManual: boolean }[] = [];
    const assignedRoomIds = new Set<string>();
    
    currentFloorGroups.forEach(group => {
      const groupRooms = currentFloorRooms.filter(r => group.roomIds.includes(r.id));
      groupRooms.forEach(r => assignedRoomIds.add(r.id));
      groups.push({
        id: group.id,
        name: group.name,
        rooms: groupRooms,
        isManual: true,
      });
    });
    
    currentFloorRooms.forEach(room => {
      if (!assignedRoomIds.has(room.id)) {
        groups.push({
          id: room.id,
          name: room.name,
          rooms: [room],
          isManual: false,
        });
      }
    });
    
    return groups;
  }, [currentFloorRooms, currentFloorGroups]);
  

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const createGroup = (name: string) => {
    const newGroup = {
      id: `group-${Date.now()}`,
      name,
      roomIds: [] as string[],
      floor: currentFloor,
    };
    setManualGroups(prev => [...prev, newGroup]);
    setExpandedGroups(prev => new Set(prev).add(newGroup.id));
    toast({ title: "Group Created", description: `Created "${name}" group` });
  };

  const addRoomToGroup = (roomId: string, groupId: string) => {
    const targetGroup = manualGroups.find(g => g.id === groupId);
    if (!targetGroup) return;
    
    setManualGroups(prev => prev.map(g => {
      if (g.id === groupId) {
        if (!g.roomIds.includes(roomId)) {
          return { ...g, roomIds: [...g.roomIds, roomId] };
        }
      } else if (g.floor === targetGroup.floor) {
        return { ...g, roomIds: g.roomIds.filter(id => id !== roomId) };
      }
      return g;
    }));
    setAddingToGroupRoomId(null);
    toast({ title: "Room Added", description: `Added to "${targetGroup.name}"` });
  };

  const removeRoomFromGroup = (roomId: string) => {
    setManualGroups(prev => prev.map(g => ({
      ...g,
      roomIds: g.roomIds.filter(id => id !== roomId),
    })));
  };

  const deleteGroup = (groupId: string) => {
    setManualGroups(prev => prev.filter(g => g.id !== groupId));
    toast({ title: "Group Deleted" });
  };

  // Save current state to history
  const saveToHistory = useCallback(() => {
    if (isUndoRedoAction) return;
    
    const newState: HistoryState = {
      rooms: JSON.parse(JSON.stringify(rooms)),
      doors: JSON.parse(JSON.stringify(doors)),
      furniture: JSON.parse(JSON.stringify(furniture)),
    };
    
    setHistoryStack(prev => {
      const newStack = prev.slice(0, historyIndex + 1);
      newStack.push(newState);
      // Keep max 50 history entries
      if (newStack.length > 50) newStack.shift();
      return newStack;
    });
    setHistoryIndex(prev => Math.min(prev + 1, 49));
  }, [rooms, doors, furniture, historyIndex, isUndoRedoAction]);

  // Track state changes and save to history
  useEffect(() => {
    if (isUndoRedoAction) {
      setIsUndoRedoAction(false);
      return;
    }
    // Only save if we have meaningful state
    if (rooms.length > 0 || doors.length > 0 || furniture.length > 0) {
      const timer = setTimeout(() => {
        saveToHistory();
      }, 500); // Debounce to avoid too many saves
      return () => clearTimeout(timer);
    }
  }, [rooms, doors, furniture]);

  const undo = useCallback(() => {
    if (historyIndex <= 0) {
      toast({ title: "Nothing to Undo", variant: "destructive" });
      return;
    }
    
    setIsUndoRedoAction(true);
    const prevState = historyStack[historyIndex - 1];
    setRooms(prevState.rooms);
    setDoors(prevState.doors);
    setFurniture(prevState.furniture);
    setHistoryIndex(prev => prev - 1);
    toast({ title: "Undone" });
  }, [historyIndex, historyStack, toast]);

  const redo = useCallback(() => {
    if (historyIndex >= historyStack.length - 1) {
      toast({ title: "Nothing to Redo", variant: "destructive" });
      return;
    }
    
    setIsUndoRedoAction(true);
    const nextState = historyStack[historyIndex + 1];
    setRooms(nextState.rooms);
    setDoors(nextState.doors);
    setFurniture(nextState.furniture);
    setHistoryIndex(prev => prev + 1);
    toast({ title: "Redone" });
  }, [historyIndex, historyStack, toast]);

  const rotateRoom = (roomId: string) => {
    setRooms(rooms.map(r => {
      if (r.id === roomId) {
        const currentRotation = r.rotation || 0;
        const newRotation = (currentRotation + 90) % 360;
        // Swap width and length when rotating
        return { 
          ...r, 
          rotation: newRotation,
          width: r.length,
          length: r.width,
        };
      }
      return r;
    }));
    toast({ title: "Room Rotated", description: "Rotated 90° clockwise" });
  };

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < historyStack.length - 1;

  const exportAsJSON = useCallback(() => {
    const floorPlanData = {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      totalFloors,
      rooms,
      furniture,
      doors,
    };
    
    const blob = new Blob([JSON.stringify(floorPlanData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `floor-plan-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({ title: "Exported", description: "Floor plan saved as JSON file" });
  }, [rooms, furniture, doors, totalFloors, toast]);

  const exportAsImage = useCallback(() => {
    const canvas = document.querySelector("canvas");
    if (!canvas) {
      toast({ title: "Error", description: "Could not capture canvas", variant: "destructive" });
      return;
    }
    
    try {
      const dataUrl = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `floor-plan-floor${currentFloor}-3d-${new Date().toISOString().split("T")[0]}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      toast({ title: "Exported", description: `Floor ${currentFloor} 3D view saved as PNG` });
    } catch (error) {
      toast({ title: "Error", description: "Failed to export image", variant: "destructive" });
    }
  }, [currentFloor, toast]);

  const exportTopDownWithMeasurements = useCallback(() => {
    const floorRooms = rooms.filter(r => r.floor === currentFloor);
    if (floorRooms.length === 0) {
      toast({ title: "No Rooms", description: "Add some rooms before exporting", variant: "destructive" });
      return;
    }

    const scale = 20;
    const padding = 100;
    
    const minX = Math.min(...floorRooms.map(r => r.x - r.width / 2));
    const maxX = Math.max(...floorRooms.map(r => r.x + r.width / 2));
    const minZ = Math.min(...floorRooms.map(r => r.z - r.length / 2));
    const maxZ = Math.max(...floorRooms.map(r => r.z + r.length / 2));
    
    const width = (maxX - minX) * scale + padding * 2;
    const height = (maxZ - minZ) * scale + padding * 2;
    
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(800, width);
    canvas.height = Math.max(600, height + 80);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = "#1a1a2e";
    ctx.font = "bold 24px Arial";
    ctx.textAlign = "center";
    ctx.fillText(`Floor ${currentFloor} - Top Down View`, canvas.width / 2, 40);
    
    ctx.font = "14px Arial";
    ctx.fillStyle = "#666666";
    ctx.fillText(`Scale: 1 unit = ${scale}px | Dimensions in feet`, canvas.width / 2, 60);
    
    const offsetX = padding - minX * scale + (canvas.width - width) / 2;
    const offsetZ = padding - minZ * scale + 80;
    
    floorRooms.forEach(room => {
      const x = room.x * scale + offsetX;
      const z = room.z * scale + offsetZ;
      const w = room.width * scale;
      const l = room.length * scale;
      
      ctx.fillStyle = room.isStairs ? "#fef3c7" : room.color;
      ctx.fillRect(x - w / 2, z - l / 2, w, l);
      
      ctx.strokeStyle = room.isStairs ? "#f59e0b" : "#374151";
      ctx.lineWidth = 2;
      ctx.strokeRect(x - w / 2, z - l / 2, w, l);
      
      ctx.fillStyle = "#1f2937";
      ctx.font = "bold 14px Arial";
      ctx.textAlign = "center";
      ctx.fillText(room.name, x, z - 5);
      
      ctx.font = "12px Arial";
      ctx.fillStyle = "#4b5563";
      ctx.fillText(`${room.width}' × ${room.length}'`, x, z + 12);
      
      if (room.isStairs) {
        ctx.font = "10px Arial";
        ctx.fillStyle = "#b45309";
        ctx.fillText(room.stairsDirection === "up" ? "↑ Going Up" : "↓ From Below", x, z + 26);
      }
      
      ctx.fillStyle = "#ef4444";
      ctx.font = "bold 11px Arial";
      
      ctx.save();
      ctx.translate(x - w / 2 - 8, z);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = "center";
      ctx.fillText(`${room.length}'`, 0, 0);
      ctx.restore();
      
      ctx.textAlign = "center";
      ctx.fillText(`${room.width}'`, x, z - l / 2 - 8);
    });
    
    const floorDoors = doors.filter(d => floorRooms.some(r => r.id === d.roomId));
    floorDoors.forEach(door => {
      const room = floorRooms.find(r => r.id === door.roomId);
      if (!room) return;
      
      const roomX = room.x * scale + offsetX;
      const roomZ = room.z * scale + offsetZ;
      const roomW = room.width * scale;
      const roomL = room.length * scale;
      
      let doorX = roomX, doorZ = roomZ;
      const doorW = door.width * scale;
      
      switch (door.wall) {
        case "north": doorZ = roomZ - roomL / 2; doorX = roomX - roomW / 2 + (door.position / 100) * roomW; break;
        case "south": doorZ = roomZ + roomL / 2; doorX = roomX - roomW / 2 + (door.position / 100) * roomW; break;
        case "east": doorX = roomX + roomW / 2; doorZ = roomZ - roomL / 2 + (door.position / 100) * roomL; break;
        case "west": doorX = roomX - roomW / 2; doorZ = roomZ - roomL / 2 + (door.position / 100) * roomL; break;
      }
      
      ctx.fillStyle = "#8b5cf6";
      if (door.wall === "north" || door.wall === "south") {
        ctx.fillRect(doorX - doorW / 2, doorZ - 4, doorW, 8);
      } else {
        ctx.fillRect(doorX - 4, doorZ - doorW / 2, 8, doorW);
      }
    });
    
    ctx.fillStyle = "#666666";
    ctx.font = "12px Arial";
    ctx.textAlign = "left";
    ctx.fillText("Legend:", 20, canvas.height - 50);
    
    ctx.fillStyle = "#e8e4e1";
    ctx.fillRect(20, canvas.height - 40, 20, 15);
    ctx.strokeStyle = "#374151";
    ctx.strokeRect(20, canvas.height - 40, 20, 15);
    ctx.fillStyle = "#666666";
    ctx.fillText("Room", 45, canvas.height - 28);
    
    ctx.fillStyle = "#fef3c7";
    ctx.fillRect(100, canvas.height - 40, 20, 15);
    ctx.strokeStyle = "#f59e0b";
    ctx.strokeRect(100, canvas.height - 40, 20, 15);
    ctx.fillStyle = "#666666";
    ctx.fillText("Stairs", 125, canvas.height - 28);
    
    ctx.fillStyle = "#8b5cf6";
    ctx.fillRect(180, canvas.height - 40, 20, 8);
    ctx.fillStyle = "#666666";
    ctx.fillText("Door", 205, canvas.height - 28);
    
    const dataUrl = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `floor-plan-floor${currentFloor}-topdown-${new Date().toISOString().split("T")[0]}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    toast({ title: "Exported", description: `Floor ${currentFloor} top-down view with measurements saved` });
  }, [rooms, doors, currentFloor, toast]);

  const exportAllViews = useCallback(async () => {
    const floorRooms = rooms.filter(r => r.floor === currentFloor);
    if (floorRooms.length === 0) {
      toast({ title: "No Rooms", description: "Add some rooms before exporting", variant: "destructive" });
      return;
    }

    toast({ title: "Capturing...", description: "Generating PDF with 3D views..." });

    const centerX = floorRooms.reduce((sum, r) => sum + r.x, 0) / floorRooms.length;
    const centerZ = floorRooms.reduce((sum, r) => sum + r.z, 0) / floorRooms.length;
    
    let cornerCaptures: string[] = [];
    if (sceneRef.current) {
      try {
        cornerCaptures = await sceneRef.current.captureFromAngles(centerX, centerZ);
      } catch (e) {
        console.error("Failed to capture corners:", e);
      }
    }
    
    if (cornerCaptures.length === 0) {
      const threeCanvas = document.querySelector("canvas") as HTMLCanvasElement;
      if (threeCanvas) {
        cornerCaptures = [threeCanvas.toDataURL("image/png")];
      }
    }

    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 15;
    
    pdf.setFontSize(20);
    pdf.setFont("helvetica", "bold");
    pdf.text(`Floor Plan - Floor ${currentFloor}`, pageWidth / 2, 20, { align: "center" });
    
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    pdf.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, 28, { align: "center" });
    
    const cornerNames = ["NE Corner View", "NW Corner View", "SE Corner View", "SW Corner View"];
    const imgWidth = (pageWidth - margin * 3) / 2;
    const imgHeight = imgWidth * 0.75;
    
    for (let i = 0; i < Math.min(cornerCaptures.length, 4); i++) {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = margin + col * (imgWidth + margin);
      const y = 35 + row * (imgHeight + 12);
      
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "bold");
      pdf.text(cornerNames[i], x, y - 2);
      
      pdf.addImage(cornerCaptures[i], "PNG", x, y, imgWidth, imgHeight);
      pdf.setDrawColor(200);
      pdf.rect(x, y, imgWidth, imgHeight);
    }
    
    pdf.addPage();
    
    pdf.setFontSize(16);
    pdf.setFont("helvetica", "bold");
    pdf.text("Top-Down View with Measurements", pageWidth / 2, 20, { align: "center" });
    
    const scale = 12;
    const padding = 40;
    const minX = Math.min(...floorRooms.map(r => r.x - r.width / 2));
    const maxX = Math.max(...floorRooms.map(r => r.x + r.width / 2));
    const minZ = Math.min(...floorRooms.map(r => r.z - r.length / 2));
    const maxZ = Math.max(...floorRooms.map(r => r.z + r.length / 2));
    
    const topDownWidth = Math.max(300, (maxX - minX) * scale + padding * 2);
    const topDownHeight = Math.max(200, (maxZ - minZ) * scale + padding * 2);
    
    const topDownCanvas = document.createElement("canvas");
    topDownCanvas.width = topDownWidth;
    topDownCanvas.height = topDownHeight;
    const ctx = topDownCanvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, topDownWidth, topDownHeight);
      
      floorRooms.forEach(room => {
        const x = (room.x - minX) * scale + padding;
        const z = (room.z - minZ) * scale + padding;
        const w = room.width * scale;
        const l = room.length * scale;
        
        ctx.fillStyle = room.isStairs ? "#fef3c7" : room.color;
        ctx.fillRect(x - w / 2, z - l / 2, w, l);
        
        ctx.strokeStyle = room.isStairs ? "#f59e0b" : "#374151";
        ctx.lineWidth = 2;
        ctx.strokeRect(x - w / 2, z - l / 2, w, l);
        
        const floorDoors = doors.filter(d => d.roomId === room.id);
        floorDoors.forEach(door => {
          ctx.fillStyle = "#8b5cf6";
          let doorX = x, doorZ = z;
          let doorW = door.width * scale, doorH = 4;
          
          if (door.wall === "north") {
            doorX = x - w / 2 + door.position * scale;
            doorZ = z + l / 2;
          } else if (door.wall === "south") {
            doorX = x - w / 2 + door.position * scale;
            doorZ = z - l / 2;
          } else if (door.wall === "east") {
            doorX = x - w / 2;
            doorZ = z - l / 2 + door.position * scale;
            doorW = 4;
            doorH = door.width * scale;
          } else {
            doorX = x + w / 2;
            doorZ = z - l / 2 + door.position * scale;
            doorW = 4;
            doorH = door.width * scale;
          }
          ctx.fillRect(doorX - doorW / 2, doorZ - doorH / 2, doorW, doorH);
        });
        
        ctx.fillStyle = "#1f2937";
        ctx.font = "bold 11px Arial";
        ctx.textAlign = "center";
        ctx.fillText(room.name, x, z - 2);
        
        ctx.font = "10px Arial";
        ctx.fillStyle = "#4b5563";
        ctx.fillText(`${room.width}' × ${room.length}'`, x, z + 10);
        
        ctx.fillStyle = "#dc2626";
        ctx.font = "bold 9px Arial";
        ctx.fillText(`${room.width}'`, x, z - l / 2 - 4);
        
        ctx.save();
        ctx.translate(x - w / 2 - 4, z);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(`${room.length}'`, 0, 0);
        ctx.restore();
      });
      
      const topDownDataUrl = topDownCanvas.toDataURL("image/png");
      const availableWidth = pageWidth - margin * 2;
      const availableHeight = pageHeight - 40;
      const aspectRatio = topDownWidth / topDownHeight;
      
      let finalWidth = availableWidth;
      let finalHeight = finalWidth / aspectRatio;
      if (finalHeight > availableHeight) {
        finalHeight = availableHeight;
        finalWidth = finalHeight * aspectRatio;
      }
      
      const xOffset = (pageWidth - finalWidth) / 2;
      pdf.addImage(topDownDataUrl, "PNG", xOffset, 30, finalWidth, finalHeight);
    }
    
    pdf.save(`floor-plan-floor${currentFloor}-${new Date().toISOString().split("T")[0]}.pdf`);
    
    toast({ title: "Exported", description: `Floor plan PDF with 3D views saved!` });
  }, [rooms, doors, currentFloor, toast, sceneRef]);

  useEffect(() => {
    if (selectedRoom && !currentFloorRooms.some(r => r.id === selectedRoom)) {
      setSelectedRoom(null);
      setSelectedFurniture(null);
    }
    setSelectedRooms(prev => {
      const filtered = new Set(Array.from(prev).filter(id => currentFloorRooms.some(r => r.id === id)));
      return filtered.size !== prev.size ? filtered : prev;
    });
  }, [currentFloor, rooms]);

  const addRoom = () => {
    if (!newRoom.name.trim()) {
      toast({ title: "Error", description: "Please enter a room name", variant: "destructive" });
      return;
    }

    const floorRooms = rooms.filter(r => r.floor === currentFloor);
    const lastRoom = floorRooms[floorRooms.length - 1];
    const newX = lastRoom ? lastRoom.x + lastRoom.width / 2 + newRoom.width / 2 + 2 : 0;

    const room: Room = {
      id: crypto.randomUUID(),
      name: newRoom.name,
      width: newRoom.width,
      length: newRoom.length,
      height: newRoom.height,
      x: newX,
      z: 0,
      color: newRoom.color,
      floor: currentFloor,
      isStairs: false,
    };

    setRooms([...rooms, room]);
    setShowAddRoomDialog(false);
    setNewRoom({ name: "", width: 12, length: 10, height: 9, color: "#e8e4e1" });
    toast({ title: "Room Added", description: `${room.name} has been added to Floor ${currentFloor}` });
  };

  const addPresetRoom = (preset: typeof ROOM_PRESETS[0]) => {
    const floorRooms = rooms.filter(r => r.floor === currentFloor);
    const lastRoom = floorRooms[floorRooms.length - 1];
    const newX = lastRoom ? lastRoom.x + lastRoom.width / 2 + preset.width / 2 + 2 : 0;

    const room: Room = {
      id: crypto.randomUUID(),
      name: preset.name,
      width: preset.width,
      length: preset.length,
      height: preset.height,
      x: newX,
      z: 0,
      color: preset.color,
      floor: currentFloor,
      isStairs: preset.isStairs,
      stairsDirection: preset.isStairs ? "up" : undefined,
    };

    setRooms([...rooms, room]);
    toast({ title: "Room Added", description: `${preset.name} has been added to Floor ${currentFloor}${preset.isStairs ? " (going up)" : ""}` });
  };

  const addFloor = () => {
    const newFloorNumber = totalFloors + 1;
    const stairsOnPreviousFloor = rooms.filter(r => r.floor === totalFloors && r.isStairs);
    
    const copiedStairs: Room[] = stairsOnPreviousFloor
      .filter(stair => stair.stairsDirection === "up")
      .map(stair => ({
        ...stair,
        id: crypto.randomUUID(),
        floor: newFloorNumber,
        stairsDirection: "down" as const,
        connectedRoomId: undefined,
        name: `Stairs from Floor ${totalFloors}`,
      }));
    
    setRooms([...rooms, ...copiedStairs]);
    setTotalFloors(newFloorNumber);
    setCurrentFloor(newFloorNumber);
    toast({ 
      title: "Floor Added", 
      description: copiedStairs.length > 0 
        ? `Floor ${newFloorNumber} created with ${copiedStairs.length} stair${copiedStairs.length > 1 ? 's' : ''} copied from Floor ${totalFloors}`
        : `Floor ${newFloorNumber} created`
    });
  };

  const removeRoom = (roomId: string) => {
    setRooms(rooms.filter((r) => r.id !== roomId));
    setFurniture(furniture.filter((f) => f.roomId !== roomId));
    setDoors(doors.filter((d) => d.roomId !== roomId));
    setManualGroups(prev => prev.map(g => ({
      ...g,
      roomIds: g.roomIds.filter(id => id !== roomId),
    })));
    if (selectedRoom === roomId) setSelectedRoom(null);
    setSelectedRooms(prev => {
      const next = new Set(prev);
      next.delete(roomId);
      return next;
    });
  };

  const toggleRoomSelection = (roomId: string) => {
    setSelectedRooms(prev => {
      const next = new Set(prev);
      if (next.has(roomId)) {
        next.delete(roomId);
      } else {
        next.add(roomId);
      }
      return next;
    });
  };

  const toggleRoomLock = (roomId: string) => {
    setRooms(rooms.map((r) =>
      r.id === roomId ? { ...r, locked: !r.locked } : r
    ));
    const room = rooms.find(r => r.id === roomId);
    toast({ 
      title: room?.locked ? "Room Unlocked" : "Room Locked", 
      description: room?.locked ? `${room.name} can now be moved` : `${room?.name} position is locked`
    });
  };

  const updateRoomPosition = (roomId: string, axis: "x" | "z", delta: number) => {
    const room = rooms.find(r => r.id === roomId);
    if (room?.locked) {
      toast({ title: "Room Locked", description: "Unlock the room to move it", variant: "destructive" });
      return;
    }
    setRooms(rooms.map((r) =>
      r.id === roomId ? { ...r, [axis]: r[axis] + delta } : r
    ));
    setFurniture(furniture.map((f) =>
      f.roomId === roomId ? { ...f, [axis]: f[axis] + delta } : f
    ));
  };

  const updateRoomDimensions = (roomId: string, field: "width" | "length" | "height" | "name", value: number | string) => {
    setRooms(rooms.map((r) =>
      r.id === roomId ? { ...r, [field]: value } : r
    ));
  };

  const updateDoorPosition = (doorId: string, delta: number) => {
    const door = doors.find(d => d.id === doorId);
    if (!door) return;
    const room = rooms.find(r => r.id === door.roomId);
    if (!room) return;
    
    const wallLength = door.wall === "north" || door.wall === "south" ? room.width : room.length;
    const minPos = door.width / 2 + 0.5;
    const maxPos = wallLength - door.width / 2 - 0.5;
    const newPos = Math.max(minPos, Math.min(maxPos, door.position + delta));
    
    setDoors(doors.map(d => d.id === doorId ? { ...d, position: newPos } : d));
  };

  const moveSelectedRooms = (axis: "x" | "z", delta: number) => {
    if (selectedRooms.size === 0) {
      toast({ title: "No Rooms Selected", description: "Check the boxes next to rooms to select them", variant: "destructive" });
      return;
    }
    setRooms(rooms.map((r) =>
      selectedRooms.has(r.id) ? { ...r, [axis]: r[axis] + delta } : r
    ));
    setFurniture(furniture.map((f) =>
      selectedRooms.has(f.roomId) ? { ...f, [axis]: f[axis] + delta } : f
    ));
  };

  const connectStairsToRoom = (stairsId: string, roomId: string | undefined) => {
    const stairsRoom = rooms.find(r => r.id === stairsId);
    if (!stairsRoom) return;

    if (roomId) {
      const connectedRoom = rooms.find(r => r.id === roomId);
      if (connectedRoom) {
        const newX = stairsRoom.x;
        let newZ: number;
        let positionDescription: string;
        
        if (stairsRoom.stairsDirection === "up") {
          newZ = stairsRoom.z - stairsRoom.length / 2 - connectedRoom.length / 2;
          positionDescription = "at bottom of stairs";
        } else {
          newZ = stairsRoom.z + stairsRoom.length / 2 + connectedRoom.length / 2;
          positionDescription = "at top of stairs (arriving from below)";
        }
        
        const deltaX = newX - connectedRoom.x;
        const deltaZ = newZ - connectedRoom.z;
        
        setRooms(rooms.map(r => {
          if (r.id === stairsId) {
            return { ...r, connectedRoomId: roomId };
          }
          if (r.id === roomId) {
            return { ...r, x: newX, z: newZ };
          }
          return r;
        }));
        
        setFurniture(furniture.map(f => 
          f.roomId === roomId ? { ...f, x: f.x + deltaX, z: f.z + deltaZ } : f
        ));
        
        toast({ title: "Connected", description: `${connectedRoom.name} positioned ${positionDescription}` });
      }
    } else {
      setRooms(rooms.map(r => 
        r.id === stairsId ? { ...r, connectedRoomId: undefined } : r
      ));
    }
  };

  const addDoor = () => {
    if (!selectedRoom) {
      toast({ title: "Select a Room", description: "Please select a room first to add a door", variant: "destructive" });
      return;
    }

    const room = rooms.find((r) => r.id === selectedRoom);
    if (!room) return;

    const wallLength = newDoor.wall === "north" || newDoor.wall === "south" ? room.width : room.length;
    const doorPosition = (newDoor.position / 100) * wallLength;

    const door: Door = {
      id: crypto.randomUUID(),
      roomId: selectedRoom,
      wall: newDoor.wall,
      position: doorPosition,
      width: newDoor.width,
      connectedRoomId: newDoor.connectedRoomId,
    };

    const newDoors = [door];
    
    if (newDoor.connectedRoomId) {
      const connectedRoom = rooms.find((r) => r.id === newDoor.connectedRoomId);
      if (connectedRoom) {
        // Check if both rooms are locked
        if (room.locked && connectedRoom.locked) {
          toast({ 
            title: "Both Rooms Locked", 
            description: "At least one room must be unlocked to connect", 
            variant: "destructive" 
          });
          return;
        }
        
        const oppositeWall: Record<string, "north" | "south" | "east" | "west"> = {
          north: "south",
          south: "north",
          east: "west",
          west: "east"
        };
        const connectedWall = oppositeWall[newDoor.wall];
        const connectedWallLength = connectedWall === "north" || connectedWall === "south" 
          ? connectedRoom.width 
          : connectedRoom.length;
        
        // Determine which room to move based on lock status
        const moveCurrentRoom = connectedRoom.locked && !room.locked;
        const moveConnectedRoom = !connectedRoom.locked;
        
        if (moveCurrentRoom) {
          // Move current room to align with locked connected room
          let newX = room.x;
          let newZ = room.z;
          const connectedDoorPos = connectedWallLength / 2;
          
          switch (newDoor.wall) {
            case "north":
              // Current room's north door connects to connected room's south wall
              newX = connectedRoom.x + connectedDoorPos - connectedRoom.width / 2 - doorPosition + room.width / 2;
              newZ = connectedRoom.z - connectedRoom.length / 2 - room.length / 2;
              break;
            case "south":
              // Current room's south door connects to connected room's north wall
              newX = connectedRoom.x + connectedDoorPos - connectedRoom.width / 2 - doorPosition + room.width / 2;
              newZ = connectedRoom.z + connectedRoom.length / 2 + room.length / 2;
              break;
            case "east":
              // Current room's east door connects to connected room's west wall
              newX = connectedRoom.x + connectedRoom.width / 2 + room.width / 2;
              newZ = connectedRoom.z + connectedDoorPos - connectedRoom.length / 2 - doorPosition + room.length / 2;
              break;
            case "west":
              // Current room's west door connects to connected room's east wall
              newX = connectedRoom.x - connectedRoom.width / 2 - room.width / 2;
              newZ = connectedRoom.z + connectedDoorPos - connectedRoom.length / 2 - doorPosition + room.length / 2;
              break;
          }
          
          const deltaX = newX - room.x;
          const deltaZ = newZ - room.z;
          
          setRooms(rooms.map((r) =>
            r.id === selectedRoom ? { ...r, x: newX, z: newZ } : r
          ));
          setFurniture(furniture.map((f) =>
            f.roomId === selectedRoom ? { ...f, x: f.x + deltaX, z: f.z + deltaZ } : f
          ));
        } else if (moveConnectedRoom) {
          // Move connected room to align with current room (original logic)
          let newX = connectedRoom.x;
          let newZ = connectedRoom.z;
          
          switch (newDoor.wall) {
            case "north":
              newX = room.x - room.width / 2 + doorPosition;
              newZ = room.z + room.length / 2 + connectedRoom.length / 2;
              break;
            case "south":
              newX = room.x - room.width / 2 + doorPosition;
              newZ = room.z - room.length / 2 - connectedRoom.length / 2;
              break;
            case "east":
              newX = room.x - room.width / 2 - connectedRoom.width / 2;
              newZ = room.z - room.length / 2 + doorPosition;
              break;
            case "west":
              newX = room.x + room.width / 2 + connectedRoom.width / 2;
              newZ = room.z - room.length / 2 + doorPosition;
              break;
          }
          
          const deltaX = newX - connectedRoom.x;
          const deltaZ = newZ - connectedRoom.z;
          
          setRooms(rooms.map((r) =>
            r.id === newDoor.connectedRoomId ? { ...r, x: newX, z: newZ } : r
          ));
          setFurniture(furniture.map((f) =>
            f.roomId === newDoor.connectedRoomId ? { ...f, x: f.x + deltaX, z: f.z + deltaZ } : f
          ));
        }
        
        const connectedDoor: Door = {
          id: crypto.randomUUID(),
          roomId: newDoor.connectedRoomId,
          wall: connectedWall,
          position: connectedWallLength / 2,
          width: newDoor.width,
          connectedRoomId: selectedRoom,
        };
        newDoors.push(connectedDoor);
      }
    }
    
    setDoors([...doors, ...newDoors]);
    
    setShowAddDoorDialog(false);
    setNewDoor({ wall: "south", position: 50, width: 3, connectedRoomId: undefined, snapConnectedRoom: true });
    toast({ title: "Door Added", description: newDoor.connectedRoomId ? `Door added and room connected` : `Door added to ${newDoor.wall} wall` });
  };

  const removeDoor = (doorId: string) => {
    const door = doors.find(d => d.id === doorId);
    if (!door) return;
    
    // Also remove the connected door on the other room
    const connectedDoorIds = door.connectedRoomId 
      ? doors.filter(d => d.roomId === door.connectedRoomId && d.connectedRoomId === door.roomId).map(d => d.id)
      : [];
    
    setDoors(doors.filter(d => d.id !== doorId && !connectedDoorIds.includes(d.id)));
    toast({ title: "Door Removed", description: "Door and wall opening removed" });
  };

  const disconnectDoor = (doorId: string) => {
    const door = doors.find(d => d.id === doorId);
    if (!door || !door.connectedRoomId) return;
    
    // Find and remove the connected door on the other room
    const connectedDoorIds = doors
      .filter(d => d.roomId === door.connectedRoomId && d.connectedRoomId === door.roomId)
      .map(d => d.id);
    
    // Remove both doors entirely to close the wall holes
    setDoors(doors.filter(d => d.id !== doorId && !connectedDoorIds.includes(d.id)));
    toast({ title: "Disconnected", description: "Connection and wall openings removed" });
  };

  const connectDoorToRoom = (doorId: string, targetRoomId: string) => {
    const door = doors.find(d => d.id === doorId);
    if (!door) return;
    
    const sourceRoom = rooms.find(r => r.id === door.roomId);
    const targetRoom = rooms.find(r => r.id === targetRoomId);
    if (!sourceRoom || !targetRoom) return;

    if (sourceRoom.locked && targetRoom.locked) {
      toast({ 
        title: "Both Rooms Locked", 
        description: "At least one room must be unlocked to connect", 
        variant: "destructive" 
      });
      return;
    }

    const oppositeWall: Record<string, "north" | "south" | "east" | "west"> = {
      north: "south",
      south: "north",
      east: "west",
      west: "east"
    };
    const targetWall = oppositeWall[door.wall];
    
    const targetWallLength = targetWall === "north" || targetWall === "south" ? targetRoom.width : targetRoom.length;
    const targetDoorPosition = targetWallLength / 2;

    // Determine which room to move: if target is locked, move source; otherwise move target
    const moveSource = targetRoom.locked;
    
    if (moveSource) {
      // Move source room to align its door with the target room
      let newSourceX = sourceRoom.x;
      let newSourceZ = sourceRoom.z;
      
      if (door.wall === "north") {
        // Source door is on north wall, target room is to the north
        // Align source room so its north door meets target's south wall
        newSourceX = targetRoom.x + targetDoorPosition - targetRoom.width / 2 - door.position + sourceRoom.width / 2;
        newSourceZ = targetRoom.z - targetRoom.length / 2 - sourceRoom.length / 2;
      } else if (door.wall === "south") {
        // Source door is on south wall, target room is to the south
        newSourceX = targetRoom.x + targetDoorPosition - targetRoom.width / 2 - door.position + sourceRoom.width / 2;
        newSourceZ = targetRoom.z + targetRoom.length / 2 + sourceRoom.length / 2;
      } else if (door.wall === "east") {
        // Source door is on east wall, target room is to the east
        newSourceX = targetRoom.x + targetRoom.width / 2 + sourceRoom.width / 2;
        newSourceZ = targetRoom.z + targetDoorPosition - targetRoom.length / 2 - door.position + sourceRoom.length / 2;
      } else if (door.wall === "west") {
        // Source door is on west wall, target room is to the west
        newSourceX = targetRoom.x - targetRoom.width / 2 - sourceRoom.width / 2;
        newSourceZ = targetRoom.z + targetDoorPosition - targetRoom.length / 2 - door.position + sourceRoom.length / 2;
      }
      
      const deltaX = newSourceX - sourceRoom.x;
      const deltaZ = newSourceZ - sourceRoom.z;
      
      setRooms(rooms.map(r => 
        r.id === sourceRoom.id ? { ...r, x: newSourceX, z: newSourceZ } : r
      ));
      setFurniture(furniture.map(f => 
        f.roomId === sourceRoom.id ? { ...f, x: f.x + deltaX, z: f.z + deltaZ } : f
      ));
    } else {
      // Move target room to align with source's door (original logic)
      let newTargetX = targetRoom.x;
      let newTargetZ = targetRoom.z;
      
      if (door.wall === "north") {
        const doorX = sourceRoom.x - sourceRoom.width / 2 + door.position;
        newTargetX = doorX - targetDoorPosition + targetRoom.width / 2;
        newTargetZ = sourceRoom.z + sourceRoom.length / 2 + targetRoom.length / 2;
      } else if (door.wall === "south") {
        const doorX = sourceRoom.x - sourceRoom.width / 2 + door.position;
        newTargetX = doorX - targetDoorPosition + targetRoom.width / 2;
        newTargetZ = sourceRoom.z - sourceRoom.length / 2 - targetRoom.length / 2;
      } else if (door.wall === "east") {
        const doorZ = sourceRoom.z - sourceRoom.length / 2 + door.position;
        newTargetX = sourceRoom.x - sourceRoom.width / 2 - targetRoom.width / 2;
        newTargetZ = doorZ - targetDoorPosition + targetRoom.length / 2;
      } else if (door.wall === "west") {
        const doorZ = sourceRoom.z - sourceRoom.length / 2 + door.position;
        newTargetX = sourceRoom.x + sourceRoom.width / 2 + targetRoom.width / 2;
        newTargetZ = doorZ - targetDoorPosition + targetRoom.length / 2;
      }

      const deltaX = newTargetX - targetRoom.x;
      const deltaZ = newTargetZ - targetRoom.z;
      
      setRooms(rooms.map(r => 
        r.id === targetRoom.id ? { ...r, x: newTargetX, z: newTargetZ } : r
      ));
      setFurniture(furniture.map(f => 
        f.roomId === targetRoom.id ? { ...f, x: f.x + deltaX, z: f.z + deltaZ } : f
      ));
    }

    const targetDoor: Door = {
      id: crypto.randomUUID(),
      roomId: targetRoomId,
      wall: targetWall,
      position: targetDoorPosition,
      width: door.width,
      connectedRoomId: door.roomId,
    };

    setDoors(doors.map(d => d.id === doorId ? { ...d, connectedRoomId: targetRoomId } : d).concat(targetDoor));
    toast({ title: "Rooms Connected", description: `${sourceRoom.name} connected to ${targetRoom.name}` });
  };

  const addFurniture = (type: typeof FURNITURE_TYPES[0]) => {
    if (!selectedRoom) {
      toast({ title: "Select a Room", description: "Please select a room first to add furniture", variant: "destructive" });
      return;
    }

    const room = rooms.find((r) => r.id === selectedRoom);
    if (!room) return;

    const item: Furniture = {
      id: crypto.randomUUID(),
      type: type.type,
      name: type.name,
      width: type.width,
      depth: type.depth,
      height: type.height,
      x: room.x,
      z: room.z,
      rotation: 0,
      color: type.color,
      roomId: selectedRoom,
    };

    setFurniture([...furniture, item]);
    setSelectedFurniture(item.id);
    toast({ title: "Furniture Added", description: `${type.name} has been added` });
  };

  const removeFurniture = (id: string) => {
    setFurniture(furniture.filter((f) => f.id !== id));
    if (selectedFurniture === id) setSelectedFurniture(null);
  };

  const updateFurniturePosition = (id: string, axis: "x" | "z", delta: number) => {
    setFurniture(furniture.map((f) => 
      f.id === id ? { ...f, [axis]: f[axis] + delta } : f
    ));
  };

  const rotateFurniture = (id: string) => {
    setFurniture(furniture.map((f) =>
      f.id === id ? { ...f, rotation: (f.rotation + 90) % 360 } : f
    ));
  };

  const resetScene = () => {
    setRooms([]);
    setFurniture([]);
    setDoors([]);
    setSelectedRoom(null);
    setSelectedFurniture(null);
    toast({ title: "Scene Reset", description: "All rooms, furniture, and doors have been cleared" });
  };

  const selectedFurnitureItem = furniture.find((f) => f.id === selectedFurniture);
  const selectedRoomData = rooms.find((r) => r.id === selectedRoom);

  const totalSquareFeet = rooms.reduce((sum, room) => sum + room.width * room.length, 0);

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col overflow-hidden">
      <div className="border-b border-border bg-card flex-shrink-0">
        <div className="px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Box className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">3D Floor Plan Builder</h1>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-sm">
              {rooms.length} Rooms | {totalSquareFeet.toLocaleString()} sq ft
            </Badge>
            <Button variant="outline" size="sm" onClick={resetScene} data-testid="button-reset">
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-80 border-r border-border bg-card overflow-hidden flex flex-col">
          <Tabs defaultValue="rooms" className="flex-1 flex flex-col">
            <TabsList className="w-full justify-start rounded-none border-b h-12 px-2">
              <TabsTrigger value="rooms" className="flex items-center gap-2">
                <Layers className="h-4 w-4" />
                Rooms
              </TabsTrigger>
              <TabsTrigger value="doors" className="flex items-center gap-2">
                <DoorOpen className="h-4 w-4" />
                Doors
              </TabsTrigger>
              <TabsTrigger value="furniture" className="flex items-center gap-2">
                <Sofa className="h-4 w-4" />
                Furniture
              </TabsTrigger>
            </TabsList>

            <TabsContent value="rooms" className="flex-1 m-0 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Room Presets</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {ROOM_PRESETS.map((preset) => (
                      <Button
                        key={preset.name}
                        variant="outline"
                        size="sm"
                        className="h-auto py-2 px-3 justify-start"
                        onClick={() => addPresetRoom(preset)}
                        data-testid={`button-preset-${preset.name.toLowerCase().replace(/\s+/g, '-')}`}
                      >
                        <div className="text-left">
                          <div className="text-xs font-medium">{preset.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {preset.width}' x {preset.length}'
                          </div>
                        </div>
                      </Button>
                    ))}
                  </div>

                  <Dialog open={showAddRoomDialog} onOpenChange={setShowAddRoomDialog}>
                    <DialogTrigger asChild>
                      <Button className="w-full" data-testid="button-add-custom-room">
                        <Plus className="h-4 w-4 mr-2" />
                        Custom Room
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add Custom Room</DialogTitle>
                        <DialogDescription>
                          Enter the dimensions for your custom room
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="room-name">Room Name</Label>
                          <Input
                            id="room-name"
                            value={newRoom.name}
                            onChange={(e) => setNewRoom({ ...newRoom, name: e.target.value })}
                            placeholder="e.g., Master Suite"
                            data-testid="input-room-name"
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <Label htmlFor="room-width">Width (ft)</Label>
                            <Input
                              id="room-width"
                              type="number"
                              value={newRoom.width}
                              onChange={(e) => setNewRoom({ ...newRoom, width: parseFloat(e.target.value) || 0 })}
                              data-testid="input-room-width"
                            />
                          </div>
                          <div>
                            <Label htmlFor="room-length">Length (ft)</Label>
                            <Input
                              id="room-length"
                              type="number"
                              value={newRoom.length}
                              onChange={(e) => setNewRoom({ ...newRoom, length: parseFloat(e.target.value) || 0 })}
                              data-testid="input-room-length"
                            />
                          </div>
                          <div>
                            <Label htmlFor="room-height">Height (ft)</Label>
                            <Input
                              id="room-height"
                              type="number"
                              value={newRoom.height}
                              onChange={(e) => setNewRoom({ ...newRoom, height: parseFloat(e.target.value) || 0 })}
                              data-testid="input-room-height"
                            />
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="room-color">Floor Color</Label>
                          <div className="flex gap-2 mt-2">
                            {["#e8e4e1", "#d4e5f7", "#f5e6d3", "#e0f0e8", "#f0e8d0", "#e8e8e8"].map((color) => (
                              <button
                                key={color}
                                className={`w-8 h-8 rounded border-2 ${newRoom.color === color ? "border-primary" : "border-transparent"}`}
                                style={{ backgroundColor: color }}
                                onClick={() => setNewRoom({ ...newRoom, color })}
                                data-testid={`button-color-${color.replace('#', '')}`}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setShowAddRoomDialog(false)}>
                          Cancel
                        </Button>
                        <Button onClick={addRoom} data-testid="button-confirm-add-room">
                          Add Room
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  <Separator />

                  <div className="flex items-center gap-2">
                    <Dialog open={showCreateGroupDialog} onOpenChange={setShowCreateGroupDialog}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="w-full">
                          <FolderPlus className="h-4 w-4 mr-2" />
                          Create Group
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Create Room Group</DialogTitle>
                          <DialogDescription>
                            Create a group to organize related rooms together.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="group-name">Group Name</Label>
                            <Input
                              id="group-name"
                              placeholder="e.g., Master Suite, Kitchen Area"
                              value={newGroupName}
                              onChange={(e) => setNewGroupName(e.target.value)}
                              data-testid="input-group-name"
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setShowCreateGroupDialog(false)}>
                            Cancel
                          </Button>
                          <Button 
                            onClick={() => {
                              if (newGroupName.trim()) {
                                createGroup(newGroupName.trim());
                                setNewGroupName("");
                                setShowCreateGroupDialog(false);
                              }
                            }}
                            disabled={!newGroupName.trim()}
                            data-testid="button-confirm-create-group"
                          >
                            Create Group
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold">Floor {currentFloor} Rooms</h3>
                      {selectedRooms.size > 0 && (
                        <Badge variant="secondary">{selectedRooms.size} selected</Badge>
                      )}
                    </div>
                    
                    {currentFloorRooms.length === 0 && currentFloorGroups.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No rooms on this floor yet. Use presets above or add a custom room.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {roomGroups.map((group) => (
                          group.isManual || group.rooms.length > 1 ? (
                            <Collapsible
                              key={group.id}
                              open={expandedGroups.has(group.id)}
                              onOpenChange={() => toggleGroup(group.id)}
                            >
                              <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/10 hover:bg-primary/15 transition-colors">
                                <CollapsibleTrigger className="flex items-center gap-2 flex-1">
                                  {expandedGroups.has(group.id) ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                  <span className="font-medium text-sm">{group.name}</span>
                                  <Badge variant="secondary" className="text-xs">
                                    {group.rooms.length} rooms
                                  </Badge>
                                </CollapsibleTrigger>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={(e) => { e.stopPropagation(); deleteGroup(group.id); }}
                                  data-testid={`button-delete-group-${group.id}`}
                                >
                                  <Trash2 className="h-3 w-3 text-destructive" />
                                </Button>
                              </div>
                              <CollapsibleContent>
                                <div className="pl-4 mt-2 space-y-2 border-l-2 border-primary/30 ml-2">
                                  {group.rooms.length === 0 && (
                                    <p className="text-xs text-muted-foreground italic py-2">
                                      Empty group. Use "Add to Group" on any room below to add it here.
                                    </p>
                                  )}
                                  {group.rooms.map((room) => (
                                    <Card
                                      key={room.id}
                                      className={`cursor-pointer transition-colors ${selectedRoom === room.id ? "border-primary" : ""} ${selectedRooms.has(room.id) ? "bg-primary/5" : ""} ${room.isStairs ? "border-amber-500/50" : ""}`}
                                      onClick={() => setSelectedRoom(room.id)}
                                      data-testid={`card-room-${room.id}`}
                                    >
                                      <CardContent className="p-3">
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-3">
                                            <Checkbox
                                              checked={selectedRooms.has(room.id)}
                                              onCheckedChange={() => toggleRoomSelection(room.id)}
                                              onClick={(e) => e.stopPropagation()}
                                              data-testid={`checkbox-room-${room.id}`}
                                            />
                                            <div>
                                              <div className="font-medium text-sm flex items-center gap-2">
                                                {room.name}
                                                {room.isStairs && (
                                                  <Badge variant="outline" className={`text-xs px-1 py-0 ${room.stairsDirection === "up" ? "text-amber-600" : "text-blue-600"}`}>
                                                    {room.stairsDirection === "up" ? "↑ Going Up" : "↓ From Below"}
                                                  </Badge>
                                                )}
                                              </div>
                                              <div className="text-xs text-muted-foreground">
                                                {room.width}' x {room.length}' x {room.height}'
                                              </div>
                                              {room.isStairs && room.connectedRoomId && (
                                                <div className="text-xs text-amber-600 flex items-center gap-1 mt-1">
                                                  <Link2 className="h-3 w-3" />
                                                  Connected to: {currentFloorRooms.find(r => r.id === room.connectedRoomId)?.name || "Room"}
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-1">
                                            {!room.isStairs && (
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8"
                                                onClick={(e) => { e.stopPropagation(); rotateRoom(room.id); }}
                                                data-testid={`button-rotate-room-${room.id}`}
                                                title="Rotate 90°"
                                              >
                                                <RotateCw className="h-4 w-4" />
                                              </Button>
                                            )}
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className={`h-8 w-8 ${room.locked ? "text-amber-600" : ""}`}
                                              onClick={(e) => { e.stopPropagation(); toggleRoomLock(room.id); }}
                                              data-testid={`button-lock-room-${room.id}`}
                                            >
                                              {room.locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                                            </Button>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-7 px-2 text-xs"
                                              onClick={(e) => { e.stopPropagation(); removeRoomFromGroup(room.id); }}
                                              data-testid={`button-ungroup-room-${room.id}`}
                                            >
                                              Ungroup
                                            </Button>
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-8 w-8"
                                              onClick={(e) => { e.stopPropagation(); removeRoom(room.id); }}
                                              data-testid={`button-remove-room-${room.id}`}
                                            >
                                              <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                          </div>
                                        </div>
                                        {selectedRoom === room.id && (
                                          <div className="mt-2 pt-2 border-t space-y-2">
                                            <Label className="text-xs font-medium">Edit Dimensions</Label>
                                            <div className="grid grid-cols-3 gap-2">
                                              <div>
                                                <Label className="text-xs text-muted-foreground">Width</Label>
                                                <Input
                                                  type="number"
                                                  min={2}
                                                  className="h-7 text-xs"
                                                  value={room.width}
                                                  onChange={(e) => updateRoomDimensions(room.id, "width", parseFloat(e.target.value) || 1)}
                                                  onClick={(e) => e.stopPropagation()}
                                                  data-testid={`input-room-width-${room.id}`}
                                                />
                                              </div>
                                              <div>
                                                <Label className="text-xs text-muted-foreground">Length</Label>
                                                <Input
                                                  type="number"
                                                  min={2}
                                                  className="h-7 text-xs"
                                                  value={room.length}
                                                  onChange={(e) => updateRoomDimensions(room.id, "length", parseFloat(e.target.value) || 1)}
                                                  onClick={(e) => e.stopPropagation()}
                                                  data-testid={`input-room-length-${room.id}`}
                                                />
                                              </div>
                                              <div>
                                                <Label className="text-xs text-muted-foreground">Height</Label>
                                                <Input
                                                  type="number"
                                                  min={7}
                                                  className="h-7 text-xs"
                                                  value={room.height}
                                                  onChange={(e) => updateRoomDimensions(room.id, "height", parseFloat(e.target.value) || 8)}
                                                  onClick={(e) => e.stopPropagation()}
                                                  data-testid={`input-room-height-${room.id}`}
                                                />
                                              </div>
                                            </div>
                                          </div>
                                        )}
                                      </CardContent>
                                    </Card>
                                  ))}
                                </div>
                              </CollapsibleContent>
                            </Collapsible>
                          ) : (
                            <Card
                              key={group.rooms[0].id}
                              className={`cursor-pointer transition-colors ${selectedRoom === group.rooms[0].id ? "border-primary" : ""} ${selectedRooms.has(group.rooms[0].id) ? "bg-primary/5" : ""} ${group.rooms[0].isStairs ? "border-amber-500/50" : ""}`}
                              onClick={() => setSelectedRoom(group.rooms[0].id)}
                              data-testid={`card-room-${group.rooms[0].id}`}
                            >
                              <CardContent className="p-3">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <Checkbox
                                      checked={selectedRooms.has(group.rooms[0].id)}
                                      onCheckedChange={() => toggleRoomSelection(group.rooms[0].id)}
                                      onClick={(e) => e.stopPropagation()}
                                      data-testid={`checkbox-room-${group.rooms[0].id}`}
                                    />
                                    <div>
                                      <div className="font-medium text-sm flex items-center gap-2">
                                        {group.rooms[0].name}
                                        {group.rooms[0].isStairs && (
                                          <Badge variant="outline" className={`text-xs px-1 py-0 ${group.rooms[0].stairsDirection === "up" ? "text-amber-600" : "text-blue-600"}`}>
                                            {group.rooms[0].stairsDirection === "up" ? "↑ Going Up" : "↓ From Below"}
                                          </Badge>
                                        )}
                                      </div>
                                      <div className="text-xs text-muted-foreground">
                                        {group.rooms[0].width}' x {group.rooms[0].length}' x {group.rooms[0].height}'
                                      </div>
                                      {group.rooms[0].isStairs && group.rooms[0].connectedRoomId && (
                                        <div className="text-xs text-amber-600 flex items-center gap-1 mt-1">
                                          <Link2 className="h-3 w-3" />
                                          Connected to: {currentFloorRooms.find(r => r.id === group.rooms[0].connectedRoomId)?.name || "Room"}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    {!group.rooms[0].isStairs && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={(e) => { e.stopPropagation(); rotateRoom(group.rooms[0].id); }}
                                        data-testid={`button-rotate-room-${group.rooms[0].id}`}
                                        title="Rotate 90°"
                                      >
                                        <RotateCw className="h-4 w-4" />
                                      </Button>
                                    )}
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className={`h-8 w-8 ${group.rooms[0].locked ? "text-amber-600" : ""}`}
                                      onClick={(e) => { e.stopPropagation(); toggleRoomLock(group.rooms[0].id); }}
                                      data-testid={`button-lock-room-${group.rooms[0].id}`}
                                    >
                                      {group.rooms[0].locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                                    </Button>
                                    {currentFloorGroups.length > 0 && (
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-7 px-2 text-xs"
                                            onClick={(e) => e.stopPropagation()}
                                            data-testid={`button-add-to-group-${group.rooms[0].id}`}
                                          >
                                            <FolderPlus className="h-3 w-3 mr-1" />
                                            Add to Group
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                          {currentFloorGroups.map(g => (
                                            <DropdownMenuItem
                                              key={g.id}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                addRoomToGroup(group.rooms[0].id, g.id);
                                              }}
                                            >
                                              {g.name}
                                            </DropdownMenuItem>
                                          ))}
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    )}
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={(e) => { e.stopPropagation(); removeRoom(group.rooms[0].id); }}
                                      data-testid={`button-remove-room-${group.rooms[0].id}`}
                                    >
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </div>
                                </div>
                                {group.rooms[0].isStairs && selectedRoom === group.rooms[0].id && (
                                  <div className="mt-2 pt-2 border-t">
                                    <Label className="text-xs">
                                      Connect to Room ({group.rooms[0].stairsDirection === "up" ? "at bottom - where you start" : "at top - where you arrive"})
                                    </Label>
                                    <Select
                                      value={group.rooms[0].connectedRoomId || "none"}
                                      onValueChange={(value) => connectStairsToRoom(group.rooms[0].id, value === "none" ? undefined : value)}
                                    >
                                      <SelectTrigger className="h-8 mt-1" data-testid="select-connect-room">
                                        <SelectValue placeholder="Select room..." />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="none">No connection</SelectItem>
                                        {currentFloorRooms
                                          .filter(r => !r.isStairs && r.id !== group.rooms[0].id)
                                          .map(r => (
                                            <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                                          ))
                                        }
                                      </SelectContent>
                                    </Select>
                                  </div>
                                )}
                                {!group.rooms[0].isStairs && selectedRoom === group.rooms[0].id && (
                                  (() => {
                                    const availableDoors = doors.filter(d => 
                                      d.roomId !== group.rooms[0].id && 
                                      !d.connectedRoomId &&
                                      currentFloorRooms.some(r => r.id === d.roomId)
                                    );
                                    if (availableDoors.length === 0) return null;
                                    return (
                                      <div className="mt-2 pt-2 border-t">
                                        <DropdownMenu>
                                          <DropdownMenuTrigger asChild>
                                            <Button variant="outline" size="sm" className="w-full text-xs" data-testid={`button-connect-to-door-${group.rooms[0].id}`}>
                                              <Link2 className="h-3 w-3 mr-1" />
                                              Connect to Existing Door
                                            </Button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent align="start" className="w-56">
                                            <DropdownMenuLabel className="text-xs">Available doors:</DropdownMenuLabel>
                                            <DropdownMenuSeparator />
                                            {availableDoors.map(door => {
                                              const ownerRoom = rooms.find(r => r.id === door.roomId);
                                              return (
                                                <DropdownMenuItem
                                                  key={door.id}
                                                  onClick={() => connectDoorToRoom(door.id, group.rooms[0].id)}
                                                  className="text-xs"
                                                >
                                                  <DoorOpen className="h-3 w-3 mr-2" />
                                                  {ownerRoom?.name} - {door.wall} wall
                                                </DropdownMenuItem>
                                              );
                                            })}
                                          </DropdownMenuContent>
                                        </DropdownMenu>
                                      </div>
                                    );
                                  })()
                                )}
                                {selectedRoom === group.rooms[0].id && (
                                  <div className="mt-2 pt-2 border-t space-y-2">
                                    <Label className="text-xs font-medium">Edit Dimensions</Label>
                                    <div className="grid grid-cols-3 gap-2">
                                      <div>
                                        <Label className="text-xs text-muted-foreground">Width</Label>
                                        <Input
                                          type="number"
                                          min={2}
                                          className="h-7 text-xs"
                                          value={group.rooms[0].width}
                                          onChange={(e) => updateRoomDimensions(group.rooms[0].id, "width", parseFloat(e.target.value) || 1)}
                                          onClick={(e) => e.stopPropagation()}
                                          data-testid={`input-room-width-${group.rooms[0].id}`}
                                        />
                                      </div>
                                      <div>
                                        <Label className="text-xs text-muted-foreground">Length</Label>
                                        <Input
                                          type="number"
                                          min={2}
                                          className="h-7 text-xs"
                                          value={group.rooms[0].length}
                                          onChange={(e) => updateRoomDimensions(group.rooms[0].id, "length", parseFloat(e.target.value) || 1)}
                                          onClick={(e) => e.stopPropagation()}
                                          data-testid={`input-room-length-${group.rooms[0].id}`}
                                        />
                                      </div>
                                      <div>
                                        <Label className="text-xs text-muted-foreground">Height</Label>
                                        <Input
                                          type="number"
                                          min={7}
                                          className="h-7 text-xs"
                                          value={group.rooms[0].height}
                                          onChange={(e) => updateRoomDimensions(group.rooms[0].id, "height", parseFloat(e.target.value) || 8)}
                                          onClick={(e) => e.stopPropagation()}
                                          data-testid={`input-room-height-${group.rooms[0].id}`}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          )
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="doors" className="flex-1 m-0 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="p-4 space-y-4">
                  {selectedRoom ? (
                    <>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Home className="h-4 w-4" />
                        Adding doors to: <span className="font-medium text-foreground">{selectedRoomData?.name}</span>
                      </div>

                      <Dialog open={showAddDoorDialog} onOpenChange={setShowAddDoorDialog}>
                        <DialogTrigger asChild>
                          <Button className="w-full" data-testid="button-add-door">
                            <Plus className="h-4 w-4 mr-2" />
                            Add Door
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Add Door</DialogTitle>
                            <DialogDescription>
                              Choose which wall to place a door on
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <Label>Wall</Label>
                              <Select 
                                value={newDoor.wall} 
                                onValueChange={(val) => setNewDoor({ ...newDoor, wall: val as "north" | "south" | "east" | "west" })}
                              >
                                <SelectTrigger data-testid="select-door-wall">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="north">North (Back)</SelectItem>
                                  <SelectItem value="south">South (Front)</SelectItem>
                                  <SelectItem value="east">East (Right)</SelectItem>
                                  <SelectItem value="west">West (Left)</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label>Position Along Wall (%)</Label>
                              <Input
                                type="number"
                                min={10}
                                max={90}
                                value={newDoor.position}
                                onChange={(e) => setNewDoor({ ...newDoor, position: parseInt(e.target.value) || 50 })}
                                data-testid="input-door-position"
                              />
                              <p className="text-xs text-muted-foreground mt-1">0% = left/start, 100% = right/end</p>
                            </div>
                            <div>
                              <Label>Door Width (ft)</Label>
                              <Input
                                type="number"
                                min={2}
                                max={8}
                                value={newDoor.width}
                                onChange={(e) => setNewDoor({ ...newDoor, width: parseFloat(e.target.value) || 3 })}
                                data-testid="input-door-width"
                              />
                            </div>
                            <div>
                              <Label>Connect to Room (Optional)</Label>
                              <Select 
                                value={newDoor.connectedRoomId || "none"} 
                                onValueChange={(val) => setNewDoor({ ...newDoor, connectedRoomId: val === "none" ? undefined : val })}
                              >
                                <SelectTrigger data-testid="select-connected-room">
                                  <SelectValue placeholder="Select a room to connect" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">No connection</SelectItem>
                                  {rooms.filter((r) => r.id !== selectedRoom && r.floor === currentFloor).map((room) => (
                                    <SelectItem key={room.id} value={room.id}>
                                      {room.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            {newDoor.connectedRoomId && (
                              <div className="flex items-center space-x-2">
                                <Checkbox
                                  id="snap-room"
                                  checked={newDoor.snapConnectedRoom}
                                  onCheckedChange={(checked) => setNewDoor({ ...newDoor, snapConnectedRoom: checked === true })}
                                  data-testid="checkbox-snap-room"
                                />
                                <Label htmlFor="snap-room" className="text-sm font-normal cursor-pointer">
                                  Move connected room to align with door
                                </Label>
                              </div>
                            )}
                            {newDoor.connectedRoomId && !newDoor.snapConnectedRoom && (
                              <p className="text-xs text-muted-foreground bg-muted p-2 rounded">
                                The connected room will stay in its current position. Make sure you've positioned it where you want it before adding the door.
                              </p>
                            )}
                          </div>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setShowAddDoorDialog(false)}>
                              Cancel
                            </Button>
                            <Button onClick={addDoor} data-testid="button-confirm-add-door">
                              Add Door
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>

                      <Separator />

                      <div>
                        <h4 className="text-sm font-medium mb-2">Doors in {selectedRoomData?.name}</h4>
                        {doors.filter((d) => d.roomId === selectedRoom).length === 0 ? (
                          <p className="text-xs text-muted-foreground text-center py-4">
                            No doors added yet
                          </p>
                        ) : (
                          <div className="space-y-3">
                            {doors.filter((d) => d.roomId === selectedRoom).map((door) => (
                              <div
                                key={door.id}
                                className="p-3 border rounded space-y-2"
                                data-testid={`door-item-${door.id}`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <DoorOpen className="h-4 w-4 text-muted-foreground" />
                                    <div>
                                      <div className="text-sm font-medium capitalize">{door.wall} Wall</div>
                                      <div className="text-xs text-muted-foreground">
                                        {door.width}' wide • Position: {door.position.toFixed(1)}'
                                      </div>
                                    </div>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => removeDoor(door.id)}
                                    data-testid={`button-remove-door-${door.id}`}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </div>
                                
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground">Move:</span>
                                  {(door.wall === "north" || door.wall === "south") ? (
                                    <>
                                      <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={() => updateDoorPosition(door.id, 0.5)}
                                        data-testid={`button-door-left-${door.id}`}
                                      >
                                        <ArrowLeftIcon className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={() => updateDoorPosition(door.id, -0.5)}
                                        data-testid={`button-door-right-${door.id}`}
                                      >
                                        <ArrowRightIcon className="h-3 w-3" />
                                      </Button>
                                    </>
                                  ) : (
                                    <>
                                      <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={() => updateDoorPosition(door.id, 0.5)}
                                        data-testid={`button-door-up-${door.id}`}
                                        title="Move North"
                                      >
                                        <ArrowUp className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={() => updateDoorPosition(door.id, -0.5)}
                                        data-testid={`button-door-down-${door.id}`}
                                        title="Move South"
                                      >
                                        <ArrowDown className="h-3 w-3" />
                                      </Button>
                                    </>
                                  )}
                                </div>

                                {door.connectedRoomId ? (
                                  <div className="text-xs text-green-600 flex items-center gap-1 bg-green-50 dark:bg-green-950 p-2 rounded">
                                    <Link2 className="h-3 w-3" />
                                    Connected to: {rooms.find((r) => r.id === door.connectedRoomId)?.name || "Room"}
                                  </div>
                                ) : (
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="outline" size="sm" className="w-full text-xs" data-testid={`button-connect-door-${door.id}`}>
                                        <Link2 className="h-3 w-3 mr-1" />
                                        Connect to Room
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start" className="w-48">
                                      <DropdownMenuLabel className="text-xs">Select room to connect:</DropdownMenuLabel>
                                      <DropdownMenuSeparator />
                                      {currentFloorRooms.filter(r => r.id !== selectedRoom && !r.isStairs).length === 0 ? (
                                        <DropdownMenuItem disabled className="text-xs">No other rooms</DropdownMenuItem>
                                      ) : (
                                        currentFloorRooms.filter(r => r.id !== selectedRoom && !r.isStairs).map(room => (
                                          <DropdownMenuItem
                                            key={room.id}
                                            onClick={() => connectDoorToRoom(door.id, room.id)}
                                            className="text-xs"
                                          >
                                            <div className="flex items-center gap-2">
                                              {room.name}
                                              {room.locked && <Lock className="h-3 w-3 text-amber-600" />}
                                            </div>
                                          </DropdownMenuItem>
                                        ))
                                      )}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-8">
                      <DoorOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">
                        Select a room from the Rooms tab to add doors
                      </p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="furniture" className="flex-1 m-0 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="p-4 space-y-4">
                  {selectedRoom ? (
                    <>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Home className="h-4 w-4" />
                        Adding to: <span className="font-medium text-foreground">{selectedRoomData?.name}</span>
                      </div>
                      
                      <div className="space-y-3">
                        <h4 className="text-sm font-medium">Living Room</h4>
                        <div className="grid grid-cols-2 gap-2">
                          {FURNITURE_TYPES.filter((f) => ["sofa", "armchair", "tv_stand"].includes(f.type)).map((type) => (
                            <Button
                              key={type.type}
                              variant="outline"
                              size="sm"
                              className="h-auto py-2 px-3 justify-start"
                              onClick={() => addFurniture(type)}
                              data-testid={`button-add-${type.type}`}
                            >
                              <type.icon className="h-4 w-4 mr-2" />
                              <span className="text-xs">{type.name}</span>
                            </Button>
                          ))}
                        </div>

                        <h4 className="text-sm font-medium">Bedroom</h4>
                        <div className="grid grid-cols-2 gap-2">
                          {FURNITURE_TYPES.filter((f) => ["bed_king", "bed_queen", "cabinet"].includes(f.type)).map((type) => (
                            <Button
                              key={type.type}
                              variant="outline"
                              size="sm"
                              className="h-auto py-2 px-3 justify-start"
                              onClick={() => addFurniture(type)}
                              data-testid={`button-add-${type.type}`}
                            >
                              <type.icon className="h-4 w-4 mr-2" />
                              <span className="text-xs">{type.name}</span>
                            </Button>
                          ))}
                        </div>

                        <h4 className="text-sm font-medium">Kitchen</h4>
                        <div className="grid grid-cols-2 gap-2">
                          {FURNITURE_TYPES.filter((f) => ["stove", "refrigerator"].includes(f.type)).map((type) => (
                            <Button
                              key={type.type}
                              variant="outline"
                              size="sm"
                              className="h-auto py-2 px-3 justify-start"
                              onClick={() => addFurniture(type)}
                              data-testid={`button-add-${type.type}`}
                            >
                              <type.icon className="h-4 w-4 mr-2" />
                              <span className="text-xs">{type.name}</span>
                            </Button>
                          ))}
                        </div>

                        <h4 className="text-sm font-medium">Bathroom</h4>
                        <div className="grid grid-cols-2 gap-2">
                          {FURNITURE_TYPES.filter((f) => ["bathtub", "toilet", "sink"].includes(f.type)).map((type) => (
                            <Button
                              key={type.type}
                              variant="outline"
                              size="sm"
                              className="h-auto py-2 px-3 justify-start"
                              onClick={() => addFurniture(type)}
                              data-testid={`button-add-${type.type}`}
                            >
                              <type.icon className="h-4 w-4 mr-2" />
                              <span className="text-xs">{type.name}</span>
                            </Button>
                          ))}
                        </div>

                        <h4 className="text-sm font-medium">Office/Dining</h4>
                        <div className="grid grid-cols-2 gap-2">
                          {FURNITURE_TYPES.filter((f) => ["dining_table", "desk"].includes(f.type)).map((type) => (
                            <Button
                              key={type.type}
                              variant="outline"
                              size="sm"
                              className="h-auto py-2 px-3 justify-start"
                              onClick={() => addFurniture(type)}
                              data-testid={`button-add-${type.type}`}
                            >
                              <type.icon className="h-4 w-4 mr-2" />
                              <span className="text-xs">{type.name}</span>
                            </Button>
                          ))}
                        </div>
                      </div>

                      <Separator />

                      {selectedFurnitureItem && (
                        <Card>
                          <CardHeader className="py-3 px-4">
                            <CardTitle className="text-sm">Selected: {selectedFurnitureItem.name}</CardTitle>
                          </CardHeader>
                          <CardContent className="py-2 px-4 space-y-3">
                            <div className="text-xs text-muted-foreground">
                              {selectedFurnitureItem.width}' x {selectedFurnitureItem.depth}' x {selectedFurnitureItem.height}'
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateFurniturePosition(selectedFurnitureItem.id, "x", -1)}
                                data-testid="button-move-left"
                              >
                                ←
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateFurniturePosition(selectedFurnitureItem.id, "z", -1)}
                                data-testid="button-move-up"
                              >
                                ↑
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateFurniturePosition(selectedFurnitureItem.id, "z", 1)}
                                data-testid="button-move-down"
                              >
                                ↓
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateFurniturePosition(selectedFurnitureItem.id, "x", 1)}
                                data-testid="button-move-right"
                              >
                                →
                              </Button>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1"
                                onClick={() => rotateFurniture(selectedFurnitureItem.id)}
                                data-testid="button-rotate"
                              >
                                <RotateCcw className="h-4 w-4 mr-2" />
                                Rotate
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="flex-1"
                                onClick={() => removeFurniture(selectedFurnitureItem.id)}
                                data-testid="button-remove-furniture"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Remove
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      <div>
                        <h4 className="text-sm font-medium mb-2">Furniture in Room</h4>
                        {furniture.filter((f) => f.roomId === selectedRoom).length === 0 ? (
                          <p className="text-xs text-muted-foreground">No furniture added yet</p>
                        ) : (
                          <div className="space-y-1">
                            {furniture.filter((f) => f.roomId === selectedRoom).map((item) => (
                              <div
                                key={item.id}
                                className={`flex items-center justify-between p-2 rounded border cursor-pointer ${selectedFurniture === item.id ? "border-primary bg-primary/5" : ""}`}
                                onClick={() => setSelectedFurniture(item.id)}
                                data-testid={`furniture-item-${item.id}`}
                              >
                                <span className="text-sm">{item.name}</span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={(e) => { e.stopPropagation(); removeFurniture(item.id); }}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-8">
                      <Home className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">
                        Select a room from the Rooms tab to add furniture
                      </p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </aside>

        <main className="flex-1 relative">
          <div className="absolute inset-0">
            {webGLSupported === false ? (
              <div className="flex items-center justify-center h-full bg-muted/50">
                <div className="text-center p-8">
                  <div className="text-4xl mb-4">🖥️</div>
                  <h3 className="text-lg font-semibold mb-2">3D View Unavailable</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    WebGL is not available. Please try refreshing the page or using a different browser.
                  </p>
                  <button
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm"
                    onClick={() => window.location.reload()}
                  >
                    Reload Page
                  </button>
                </div>
              </div>
            ) : webGLSupported === null ? (
              <div className="flex items-center justify-center h-full bg-muted/50">
                <p className="text-muted-foreground">Loading 3D view...</p>
              </div>
            ) : (
              <WebGLErrorBoundary>
                <Canvas shadows gl={{ preserveDrawingBuffer: true }} onClick={() => setSelectedFurniture(null)}>
                  <Suspense fallback={null}>
                    <Scene
                      rooms={currentFloorRooms}
                      furniture={furniture.filter(f => currentFloorRooms.some(r => r.id === f.roomId))}
                      doors={doors.filter(d => currentFloorRooms.some(r => r.id === d.roomId))}
                      selectedFurniture={selectedFurniture}
                      onSelectFurniture={setSelectedFurniture}
                      cameraView={cameraView}
                      resetTrigger={cameraResetTrigger}
                      sceneRef={sceneRef}
                    />
                  </Suspense>
                </Canvas>
              </WebGLErrorBoundary>
            )}
          </div>

          <div className="absolute top-4 right-4 flex flex-col gap-2">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={undo}
                disabled={!canUndo}
                data-testid="button-undo"
              >
                <Undo className="h-4 w-4 mr-2" />
                Undo
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={redo}
                disabled={!canRedo}
                data-testid="button-redo"
              >
                <Redo className="h-4 w-4 mr-2" />
                Redo
              </Button>
              <Button
                variant={cameraView === "perspective" ? "default" : "outline"}
                size="sm"
                onClick={() => setCameraView("perspective")}
                data-testid="button-perspective-view"
              >
                <Video className="h-4 w-4 mr-2" />
                3D View
              </Button>
              <Button
                variant={cameraView === "top" ? "default" : "outline"}
                size="sm"
                onClick={() => setCameraView("top")}
                data-testid="button-top-view"
              >
                <Eye className="h-4 w-4 mr-2" />
                Top View
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCameraResetTrigger(prev => prev + 1)}
                data-testid="button-reset-view"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset View
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" data-testid="button-export">
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={exportAllViews} data-testid="menu-export-complete">
                    <FileText className="h-4 w-4 mr-2" />
                    Complete Export (3D + Top-Down)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportAsImage} data-testid="menu-export-image">
                    <Image className="h-4 w-4 mr-2" />
                    Current 3D View Only
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportTopDownWithMeasurements} data-testid="menu-export-topdown">
                    <Grid3X3 className="h-4 w-4 mr-2" />
                    Top-Down with Measurements
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportAsJSON} data-testid="menu-export-json">
                    <FileJson className="h-4 w-4 mr-2" />
                    Export as JSON Data
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            
            {(selectedRoom || selectedRooms.size > 0) && (
              <div className="bg-card/90 backdrop-blur-sm border rounded-lg p-2 flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  Move {selectedRooms.size > 0 ? `${selectedRooms.size} rooms` : selectedRoomData?.name}:
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => selectedRooms.size > 0 ? moveSelectedRooms("x", 1) : selectedRoom && updateRoomPosition(selectedRoom, "x", 1)}
                  disabled={selectedRooms.size === 0 && selectedRoomData?.locked}
                  data-testid="button-move-left"
                >
                  <ArrowLeftIcon className="h-3 w-3" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => selectedRooms.size > 0 ? moveSelectedRooms("z", 1) : selectedRoom && updateRoomPosition(selectedRoom, "z", 1)}
                  disabled={selectedRooms.size === 0 && selectedRoomData?.locked}
                  data-testid="button-move-up"
                >
                  <ArrowUp className="h-3 w-3" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => selectedRooms.size > 0 ? moveSelectedRooms("z", -1) : selectedRoom && updateRoomPosition(selectedRoom, "z", -1)}
                  disabled={selectedRooms.size === 0 && selectedRoomData?.locked}
                  data-testid="button-move-down"
                >
                  <ArrowDown className="h-3 w-3" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => selectedRooms.size > 0 ? moveSelectedRooms("x", -1) : selectedRoom && updateRoomPosition(selectedRoom, "x", -1)}
                  disabled={selectedRooms.size === 0 && selectedRoomData?.locked}
                  data-testid="button-move-right"
                >
                  <ArrowRightIcon className="h-3 w-3" />
                </Button>
                <Separator orientation="vertical" className="h-5" />
                {selectedRooms.size === 0 && selectedRoom && !selectedRoomData?.isStairs && (
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => selectedRoom && rotateRoom(selectedRoom)}
                    disabled={selectedRoomData?.locked}
                    data-testid="button-rotate-room"
                    title="Rotate 90°"
                  >
                    <RotateCw className="h-3 w-3" />
                  </Button>
                )}
                {selectedRooms.size > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    onClick={() => setSelectedRooms(new Set())}
                    data-testid="button-clear-selection"
                  >
                    Clear
                  </Button>
                )}
              </div>
            )}
          </div>

          <div className="absolute top-4 left-4 bg-card/90 backdrop-blur-sm border rounded-lg p-3">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Floor:</span>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalFloors }, (_, i) => i + 1).map(floor => (
                  <Button
                    key={floor}
                    variant={currentFloor === floor ? "default" : "outline"}
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => setCurrentFloor(floor)}
                    data-testid={`button-floor-${floor}`}
                  >
                    {floor}
                  </Button>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2"
                  onClick={addFloor}
                  data-testid="button-add-floor"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add
                </Button>
              </div>
            </div>
          </div>

          <div className="absolute bottom-4 left-4 bg-card/90 backdrop-blur-sm border rounded-lg p-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              <span><strong>Rotate:</strong> Left-click drag</span>
              <span><strong>Pan:</strong> Right-click drag</span>
              <span><strong>Zoom:</strong> Scroll wheel</span>
            </div>
          </div>

          {rooms.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <Card className="max-w-md pointer-events-auto">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Grid3X3 className="h-5 w-5" />
                    Get Started
                  </CardTitle>
                  <CardDescription>
                    Add rooms using the presets on the left sidebar, then furnish them to create your floor plan.
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
