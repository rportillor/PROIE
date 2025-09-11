/**
 * ROOM QUERY SYSTEM
 * Query all elements in a specific room (e.g., Room 201)
 * Returns doors, windows, walls, M&E equipment, etc.
 */

import { storage } from "./server/storage";

async function queryRoomElements(roomNumber: string) {
  console.log(`\n📊 QUERYING ELEMENTS FOR ROOM ${roomNumber}`);
  console.log('=' .repeat(60));
  
  const modelId = 'b6339126-4185-4dfd-a6fd-ac9c184d0c5e';
  const allElements = await storage.getBimElements(modelId);
  
  // Filter elements for this room
  const roomElements = allElements.filter(element => {
    const geometry = element.geometry as any;
    const properties = element.properties as any;
    
    return (
      geometry?.roomNumber === roomNumber ||
      geometry?.roomFrom?.includes(roomNumber) ||
      geometry?.roomTo?.includes(roomNumber) ||
      properties?.roomNumber === roomNumber
    );
  });
  
  // Categorize elements by type
  const categorized = {
    doors: [] as any[],
    windows: [] as any[],
    walls: [] as any[],
    mAndE: [] as any[],
    plumbing: [] as any[],
    other: [] as any[]
  };
  
  roomElements.forEach(element => {
    const id = element.elementId;
    const name = (element.properties as any)?.name;
    const type = (element.properties as any)?.elementType;
    
    if (id.startsWith('D') || type === 'Door') {
      categorized.doors.push(element);
    } else if (id.startsWith('W') || type === 'Window') {
      categorized.windows.push(element);
    } else if (type === 'Wall' || id.includes('WALL')) {
      categorized.walls.push(element);
    } else if (id.startsWith('ME') || id.startsWith('EP') || 
               id.startsWith('HVAC') || type?.includes('Equipment')) {
      categorized.mAndE.push(element);
    } else if (type?.includes('Plumbing') || name?.includes('WC') || 
               name?.includes('Washroom')) {
      categorized.plumbing.push(element);
    } else {
      categorized.other.push(element);
    }
  });
  
  // Display results
  console.log(`\n🚪 DOORS (${categorized.doors.length}):`);
  categorized.doors.forEach(door => {
    const props = door.properties as any;
    const geo = door.geometry as any;
    console.log(`   - ${door.elementId}: ${props.name}`);
    console.log(`     Size: ${props.size || 'N/A'}`);
    console.log(`     Connects: ${geo.roomFrom || 'N/A'} → ${geo.roomTo || 'N/A'}`);
  });
  
  console.log(`\n🪟 WINDOWS (${categorized.windows.length}):`);
  categorized.windows.forEach(window => {
    const props = window.properties as any;
    console.log(`   - ${window.elementId}: ${props.name}`);
    console.log(`     Size: ${props.size || 'N/A'}`);
    console.log(`     Type: ${props.type || 'N/A'}`);
  });
  
  console.log(`\n🧱 WALLS (${categorized.walls.length}):`);
  categorized.walls.forEach(wall => {
    const props = wall.properties as any;
    const geo = wall.geometry as any;
    const length = calculateWallLength(geo);
    console.log(`   - ${wall.elementId}: ${props.name}`);
    console.log(`     Type: ${geo.wallType || props.wallType || 'N/A'}`);
    console.log(`     Length: ${length.toFixed(2)}m`);
    console.log(`     Thickness: ${geo.dimensions?.depth || props.wallThickness || 200}mm`);
  });
  
  console.log(`\n⚙️ M&E EQUIPMENT (${categorized.mAndE.length}):`);
  categorized.mAndE.forEach(equipment => {
    const props = equipment.properties as any;
    const geo = equipment.geometry as any;
    console.log(`   - ${equipment.elementId}: ${props.name}`);
    console.log(`     Type: ${geo.equipmentType || props.elementType || 'N/A'}`);
    console.log(`     Grid Location: ${geo.gridLocation || 'N/A'}`);
    console.log(`     Mounting Height: ${geo.mountingHeight || 'N/A'}m`);
  });
  
  console.log(`\n🚿 PLUMBING/WASHROOMS (${categorized.plumbing.length}):`);
  categorized.plumbing.forEach(item => {
    const props = item.properties as any;
    console.log(`   - ${item.elementId}: ${props.name}`);
  });
  
  // Summary
  console.log('\n' + '=' .repeat(60));
  console.log(`📊 ROOM ${roomNumber} SUMMARY:`);
  console.log(`   Total Elements: ${roomElements.length}`);
  console.log(`   - Doors: ${categorized.doors.length}`);
  console.log(`   - Windows: ${categorized.windows.length}`);
  console.log(`   - Walls: ${categorized.walls.length} (Total length: ${
    categorized.walls.reduce((sum, wall) => 
      sum + calculateWallLength(wall.geometry), 0).toFixed(2)
  }m)`);
  console.log(`   - M&E Equipment: ${categorized.mAndE.length}`);
  console.log(`   - Plumbing/Washrooms: ${categorized.plumbing.length}`);
  console.log('=' .repeat(60));
  
  return categorized;
}

function calculateWallLength(geometry: any): number {
  if (geometry?.wallStartPoint && geometry?.wallEndPoint) {
    const dx = geometry.wallEndPoint.x - geometry.wallStartPoint.x;
    const dy = geometry.wallEndPoint.y - geometry.wallStartPoint.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
  return geometry?.dimensions?.width || 0;
}

// Example usage - query Room 201
async function demo() {
  // Try Room 201
  await queryRoomElements('201');
  
  // Also show what rooms we have
  const modelId = 'b6339126-4185-4dfd-a6fd-ac9c184d0c5e';
  const allElements = await storage.getBimElements(modelId);
  
  const rooms = new Set<string>();
  allElements.forEach(element => {
    const roomNum = (element.geometry as any)?.roomNumber;
    if (roomNum) rooms.add(roomNum);
  });
  
  if (rooms.size > 0) {
    console.log('\n📍 Available rooms:', Array.from(rooms).sort().join(', '));
  } else {
    console.log('\n⏳ No room data yet - processing floor plans will extract room associations');
  }
}

demo().catch(console.error);