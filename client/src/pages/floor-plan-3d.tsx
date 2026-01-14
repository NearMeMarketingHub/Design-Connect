import React, { useState, useRef, Suspense, useCallback, useEffect, useMemo } from "react";
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
} from "@/components/ui/dropdown-menu";
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
  FileJson,
  Image,
  FileText,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";

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
  isStairs?: boolean;
  stairsDirection?: "up" | "down";
  connectedRoomId?: string;
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

const ROOM_PRESETS = [
  { name: "Living Room", width: 15, length: 12, height: 9, color: "#e8e4e1", isStairs: false },
  { name: "Master Bedroom", width: 14, length: 12, height: 9, color: "#d4e5f7", isStairs: false },
  { name: "Bedroom", width: 12, length: 10, height: 9, color: "#d4e5f7", isStairs: false },
  { name: "Kitchen", width: 12, length: 10, height: 9, color: "#f5e6d3", isStairs: false },
  { name: "Bathroom", width: 8, length: 6, height: 9, color: "#e0f0e8", isStairs: false },
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
    </group>
  );
}

function Wall({ start, end, height, thickness = 0.5, doors = [] }: { 
  start: [number, number]; 
  end: [number, number]; 
  height: number; 
  thickness?: number;
  doors?: { position: number; width: number }[];
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
    doorFrames.push(
      <DoorFrame 
        key={`door-${index}`} 
        position={[doorX, 0, doorZ]} 
        rotation={-angle} 
        width={door.width} 
        height={height} 
      />
    );

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
    return roomDoors
      .filter(d => d.wall === wall)
      .map(d => ({ position: d.position, width: d.width }));
  };

  return (
    <group position={[room.x, 0.05, room.z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[room.width, room.length]} />
        <meshStandardMaterial color={room.color} />
      </mesh>
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
        doors={getDoorsForWall("east")}
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
        doors={getDoorsForWall("west")}
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
  
  const centerX = rooms.length > 0 
    ? rooms.reduce((sum, r) => sum + r.x, 0) / rooms.length 
    : 0;
  const centerZ = rooms.length > 0 
    ? rooms.reduce((sum, r) => sum + r.z, 0) / rooms.length 
    : 0;
  
  const defaultPos = { x: 30, y: 30, z: 30 };
  
  if (lastView.current !== view || lastReset.current !== resetTrigger) {
    isAnimating.current = true;
    lastView.current = view;
    lastReset.current = resetTrigger;
  }
  
  useFrame(() => {
    if (!isAnimating.current) return;
    
    if (view === "top") {
      const targetY = 60;
      camera.position.x += (centerX - camera.position.x) * 0.1;
      camera.position.y += (targetY - camera.position.y) * 0.1;
      camera.position.z += (centerZ + 0.1 - camera.position.z) * 0.1;
      camera.lookAt(centerX, 0, centerZ);
      if (controlsRef.current) {
        controlsRef.current.target.set(centerX, 0, centerZ);
      }
      const dist = Math.abs(camera.position.y - targetY);
      if (dist < 0.5) isAnimating.current = false;
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

function Scene({ rooms, furniture, doors, selectedFurniture, onSelectFurniture, cameraView, resetTrigger }: {
  rooms: Room[];
  furniture: Furniture[];
  doors: Door[];
  selectedFurniture: string | null;
  onSelectFurniture: (id: string | null) => void;
  cameraView: CameraView;
  resetTrigger: number;
}) {
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
    </>
  );
}

export default function FloorPlan3D() {
  const { currentPortal } = useAuth();
  const { toast } = useToast();
  
  const [rooms, setRooms] = useState<Room[]>([]);
  const [furniture, setFurniture] = useState<Furniture[]>([]);
  const [doors, setDoors] = useState<Door[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [selectedRooms, setSelectedRooms] = useState<Set<string>>(new Set());
  const [selectedFurniture, setSelectedFurniture] = useState<string | null>(null);
  const [showAddRoomDialog, setShowAddRoomDialog] = useState(false);
  const [showAddDoorDialog, setShowAddDoorDialog] = useState(false);
  const [cameraView, setCameraView] = useState<CameraView>("perspective");
  const [cameraResetTrigger, setCameraResetTrigger] = useState(0);
  const [currentFloor, setCurrentFloor] = useState(1);
  const [totalFloors, setTotalFloors] = useState(1);
  const [newDoor, setNewDoor] = useState<{ wall: "north" | "south" | "east" | "west"; position: number; width: number; connectedRoomId?: string }>({
    wall: "south",
    position: 50,
    width: 3,
    connectedRoomId: undefined,
  });
  
  const [newRoom, setNewRoom] = useState({
    name: "",
    width: 12,
    length: 10,
    height: 9,
    color: "#e8e4e1",
  });

  const dashboardPath = currentPortal === "admin" ? "/admin/dashboard" : "/contractor/dashboard";
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const currentFloorRooms = rooms.filter(r => r.floor === currentFloor);

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
      a.download = `floor-plan-floor${currentFloor}-${new Date().toISOString().split("T")[0]}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      toast({ title: "Exported", description: `Floor ${currentFloor} saved as PNG image` });
    } catch (error) {
      toast({ title: "Error", description: "Failed to export image", variant: "destructive" });
    }
  }, [currentFloor, toast]);

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

  const updateRoomPosition = (roomId: string, axis: "x" | "z", delta: number) => {
    setRooms(rooms.map((r) =>
      r.id === roomId ? { ...r, [axis]: r[axis] + delta } : r
    ));
    setFurniture(furniture.map((f) =>
      f.roomId === roomId ? { ...f, [axis]: f[axis] + delta } : f
    ));
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

    setDoors([...doors, door]);
    
    if (newDoor.connectedRoomId) {
      const connectedRoom = rooms.find((r) => r.id === newDoor.connectedRoomId);
      if (connectedRoom) {
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
            newX = room.x + room.width / 2 + connectedRoom.width / 2;
            newZ = room.z - room.length / 2 + doorPosition;
            break;
          case "west":
            newX = room.x - room.width / 2 - connectedRoom.width / 2;
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
    }
    
    setShowAddDoorDialog(false);
    setNewDoor({ wall: "south", position: 50, width: 3, connectedRoomId: undefined });
    toast({ title: "Door Added", description: newDoor.connectedRoomId ? `Door added and room connected` : `Door added to ${newDoor.wall} wall` });
  };

  const removeDoor = (doorId: string) => {
    setDoors(doors.filter((d) => d.id !== doorId));
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
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card">
        <div className="px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href={dashboardPath}>
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Box className="h-6 w-6" />
                3D Floor Plan Builder
              </h1>
              <p className="text-sm text-muted-foreground">
                Create and visualize room layouts in 3D
              </p>
            </div>
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

      <div className="flex h-[calc(100vh-80px)]">
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

                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold">Floor {currentFloor} Rooms</h3>
                      {selectedRooms.size > 0 && (
                        <Badge variant="secondary">{selectedRooms.size} selected</Badge>
                      )}
                    </div>
                    
                    {currentFloorRooms.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No rooms on this floor yet. Use presets above or add a custom room.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {currentFloorRooms.map((room) => (
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
                                        <Badge 
                                          variant="outline" 
                                          className={`text-xs px-1 py-0 ${room.stairsDirection === "up" ? "text-amber-600" : "text-blue-600"}`}
                                        >
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
                              {room.isStairs && selectedRoom === room.id && (
                                <div className="mt-2 pt-2 border-t">
                                  <Label className="text-xs">
                                    Connect to Room ({room.stairsDirection === "up" ? "at bottom - where you start" : "at top - where you arrive"})
                                  </Label>
                                  <Select
                                    value={room.connectedRoomId || "none"}
                                    onValueChange={(value) => connectStairsToRoom(room.id, value === "none" ? undefined : value)}
                                  >
                                    <SelectTrigger className="h-8 mt-1" data-testid="select-connect-room">
                                      <SelectValue placeholder="Select room..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="none">No connection</SelectItem>
                                      {currentFloorRooms
                                        .filter(r => !r.isStairs && r.id !== room.id)
                                        .map(r => (
                                          <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                                        ))
                                      }
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}
                            </CardContent>
                          </Card>
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
                                  {rooms.filter((r) => r.id !== selectedRoom).map((room) => (
                                    <SelectItem key={room.id} value={room.id}>
                                      {room.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <p className="text-xs text-muted-foreground mt-1">
                                Connecting will snap the selected room to this door
                              </p>
                            </div>
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
                          <div className="space-y-2">
                            {doors.filter((d) => d.roomId === selectedRoom).map((door) => (
                              <div
                                key={door.id}
                                className="flex items-center justify-between p-2 border rounded"
                                data-testid={`door-item-${door.id}`}
                              >
                                <div className="flex items-center gap-2">
                                  <DoorOpen className="h-4 w-4 text-muted-foreground" />
                                  <div>
                                    <div className="text-sm font-medium capitalize">{door.wall} Wall</div>
                                    <div className="text-xs text-muted-foreground">
                                      {door.width}' wide
                                      {door.connectedRoomId && (
                                        <span className="flex items-center gap-1 mt-0.5">
                                          <Link2 className="h-3 w-3" />
                                          {rooms.find((r) => r.id === door.connectedRoomId)?.name || "Connected"}
                                        </span>
                                      )}
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
                />
              </Suspense>
            </Canvas>
          </div>

          <div className="absolute top-4 right-4 flex flex-col gap-2">
            <div className="flex gap-2">
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
                  <DropdownMenuItem onClick={exportAsImage} data-testid="menu-export-image">
                    <Image className="h-4 w-4 mr-2" />
                    Export as Image (PNG)
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
                  onClick={() => selectedRooms.size > 0 ? moveSelectedRooms("x", -1) : selectedRoom && updateRoomPosition(selectedRoom, "x", -1)}
                  data-testid="button-move-left"
                >
                  <ArrowLeftIcon className="h-3 w-3" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => selectedRooms.size > 0 ? moveSelectedRooms("z", -1) : selectedRoom && updateRoomPosition(selectedRoom, "z", -1)}
                  data-testid="button-move-up"
                >
                  <ArrowUp className="h-3 w-3" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => selectedRooms.size > 0 ? moveSelectedRooms("z", 1) : selectedRoom && updateRoomPosition(selectedRoom, "z", 1)}
                  data-testid="button-move-down"
                >
                  <ArrowDown className="h-3 w-3" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => selectedRooms.size > 0 ? moveSelectedRooms("x", 1) : selectedRoom && updateRoomPosition(selectedRoom, "x", 1)}
                  data-testid="button-move-right"
                >
                  <ArrowRightIcon className="h-3 w-3" />
                </Button>
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
