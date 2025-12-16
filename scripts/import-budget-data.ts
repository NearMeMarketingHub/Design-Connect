import XLSX from 'xlsx';
import { db } from '../server/db';
import { budgetCategories, budgetItems } from '../shared/schema';

async function importBudgetData() {
  const workbook = XLSX.readFile('./attached_assets/Avery_Master_Budget_Template_3-20-25_1765909011779.xlsx');
  
  const laborSheet = workbook.Sheets['Labor_Budget'];
  if (!laborSheet) {
    console.log('Available sheets:', workbook.SheetNames);
    throw new Error('Labor_Budget sheet not found');
  }
  
  const laborData = XLSX.utils.sheet_to_json(laborSheet, { header: 1 }) as any[][];
  console.log('Labor data rows:', laborData.length);
  
  const categories: { name: string; order: number; items: any[] }[] = [];
  let currentCategory: { name: string; order: number; items: any[] } | null = null;
  let categoryOrder = 0;
  
  const knownCategories = [
    'Administrative', 'Demo/Disposal', 'Masonry', 'Structural', 'Exterior Framing',
    'Interior Framing', 'Stairs', 'Windows/Doors', 'Roofing', 'Siding/Eaves',
    'Insulation', 'Finish Drywall', 'Finish Carpentry', 'Fireplace', 'Garage',
    'Garage Doors', 'Hardware', 'Flooring', 'Concrete', 'Driveway/Patio',
    'Landscaping', 'Pools', 'Plumbing', 'Electrical', 'HVAC',
    'Cabinetry', 'Paint', 'Countertop', 'Tile/Stone', 'Appliances', 'Misc Items'
  ];
  
  for (let i = 0; i < laborData.length; i++) {
    const row = laborData[i];
    if (!row || row.length === 0) continue;
    
    const cellA = row[0]?.toString().trim();
    
    if (cellA && knownCategories.includes(cellA)) {
      if (currentCategory) {
        categories.push(currentCategory);
      }
      currentCategory = { name: cellA, order: categoryOrder++, items: [] };
      continue;
    }
    
    if (currentCategory && cellA && !cellA.includes('SUBTOTAL') && 
        !cellA.includes('Category') && !cellA.includes('Item') && 
        cellA !== 'TOTALS' && cellA !== 'GRAND TOTAL') {
      
      const item = {
        itemType: row[0]?.toString() || '',
        description: row[1]?.toString() || cellA,
        quantity: parseFloat(row[2]) || 0,
        mandays: parseFloat(row[3]) || 0,
        units: parseFloat(row[4]) || 0,
        unitType: row[5]?.toString() || 'ea',
        cost: parseFloat(row[6]) || 0,
        burdens: parseFloat(row[7]) || 0,
        materialFee: parseFloat(row[8]) || 0,
        laborRate: parseFloat(row[9]) || 0,
        subRate: parseFloat(row[10]) || 0,
        retailPrice: parseFloat(row[11]) || 0,
        notes: row[12]?.toString() || '',
      };
      
      if (item.description && item.description.length > 0) {
        currentCategory.items.push(item);
      }
    }
  }
  
  if (currentCategory) {
    categories.push(currentCategory);
  }
  
  console.log('Found categories:', categories.map(c => `${c.name} (${c.items.length} items)`));
  
  for (const cat of categories) {
    const [insertedCat] = await db.insert(budgetCategories).values({
      name: cat.name,
      displayOrder: cat.order,
      isActive: true,
    }).returning();
    
    console.log(`Inserted category: ${cat.name}`);
    
    let itemOrder = 0;
    for (const item of cat.items) {
      await db.insert(budgetItems).values({
        categoryId: insertedCat.id,
        itemType: item.itemType || cat.name,
        description: item.description,
        unitType: item.unitType,
        cost: item.cost.toString(),
        burdens: item.burdens.toString(),
        materialFee: item.materialFee.toString(),
        laborRate: item.laborRate.toString(),
        subRate: item.subRate.toString(),
        retailPrice: item.retailPrice.toString(),
        notes: item.notes,
        displayOrder: itemOrder++,
        isActive: true,
      });
    }
  }
  
  const floorCategories = [
    { name: 'Floor Removal - Tile', items: [{ itemType: 'removal', description: 'Remove Tile Flooring', unitType: 'sqft' }] },
    { name: 'Floor Removal - Wood Glue', items: [{ itemType: 'removal', description: 'Remove Glued Wood Flooring', unitType: 'sqft' }] },
    { name: 'Floor Removal - Wood Nail', items: [{ itemType: 'removal', description: 'Remove Nailed Wood Flooring', unitType: 'sqft' }] },
    { name: 'Floor Removal - Carpet/Vinyl', items: [{ itemType: 'removal', description: 'Remove Carpet or Glued Vinyl', unitType: 'sqft' }] },
    { name: 'Floor Removal - Carpet/Laminate', items: [{ itemType: 'removal', description: 'Remove Carpet or Floating Laminate', unitType: 'sqft' }] },
    { name: 'Floor Install - Tile', items: [{ itemType: 'install', description: 'Install Tile Flooring', unitType: 'sqft' }] },
    { name: 'Floor Install - Tile Pattern', items: [{ itemType: 'install', description: 'Install Tile Flooring (Pattern)', unitType: 'sqft' }] },
    { name: 'Floor Install - Tile Mud', items: [{ itemType: 'install', description: 'Install Tile Flooring (Mud Set)', unitType: 'sqft' }] },
    { name: 'Floor Install - Wood', items: [{ itemType: 'install', description: 'Install Wood Flooring', unitType: 'sqft' }] },
    { name: 'Floor Install - LVT', items: [{ itemType: 'install', description: 'Install LVT Flooring', unitType: 'sqft' }] },
    { name: 'Floor Install - Laminate', items: [{ itemType: 'install', description: 'Install Laminate Flooring', unitType: 'sqft' }] },
    { name: 'Floor Install - Carpet', items: [{ itemType: 'install', description: 'Install Carpet', unitType: 'sqft' }] },
  ];
  
  for (const floorCat of floorCategories) {
    const [insertedFloorCat] = await db.insert(budgetCategories).values({
      name: floorCat.name,
      displayOrder: categoryOrder++,
      isActive: true,
      notes: 'Floor Calculator'
    }).returning();
    
    for (const item of floorCat.items) {
      await db.insert(budgetItems).values({
        categoryId: insertedFloorCat.id,
        itemType: item.itemType,
        description: item.description,
        unitType: item.unitType,
        cost: '0',
        burdens: '0',
        materialFee: '0',
        laborRate: '0',
        subRate: '0',
        retailPrice: '0',
        displayOrder: 0,
        isActive: true,
      });
    }
  }
  
  console.log('Import complete!');
}

importBudgetData()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Import failed:', err);
    process.exit(1);
  });
