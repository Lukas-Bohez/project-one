/**
 * RebirthThemes.js - Dark narrative progression system
 * Each rebirth deteriorates the world, changing what everything represents
 * From tech empire → grocery store → mines → eventually just struggling to survive
 */

class RebirthThemes {
    constructor() {
        this.themes = this.initializeThemes();
    }

    initializeThemes() {
        return [
            {
                // Rebirth 0 - Starting Point: Tech Giant
                id: 0,
                name: "Tech Empire",
                description: "You're running a cutting-edge technology company",
                atmosphere: "bright",
                colorScheme: {
                    primary: "#00b4d8",
                    secondary: "#0077b6",
                    background: "linear-gradient(135deg, #88a1c0ff  0%, #a8b5c2ff 50%, #859cb8ff 100%)"
                },
                resources: {
                    stone: { name: "Code Commits", emoji: "💻", description: "Lines of code written" },
                    coal: { name: "Cloud Servers", emoji: "☁️", description: "Server instances" },
                    iron: { name: "User Accounts", emoji: "👥", description: "Active users" },
                    silver: { name: "Premium Subs", emoji: "⭐", description: "Premium subscriptions" },
                    gold: { name: "Venture Capital", emoji: "💰", description: "Investment money" }
                },
                workers: {
                    stoneMiners: { name: "Junior Devs", emoji: "👨‍💻" },
                    coalMiners: { name: "DevOps Engineers", emoji: "⚙️" },
                    ironMiners: { name: "Growth Hackers", emoji: "📈" },
                    silverMiners: { name: "Sales Reps", emoji: "🤝" }
                },
                processors: {
                    smelters: { name: "Code Compiler", description: "Compiles code into deployable apps" },
                    forges: { name: "Data Center", description: "Hosts cloud infrastructure" },
                    refineries: { name: "Marketing Engine", description: "Converts users to premium" },
                    mints: { name: "IPO Machine", description: "Generates massive capital" }
                },
                traders: {
                    stoneTraders: { name: "Tech Recruiters" },
                    coalTraders: { name: "Cloud Salespeople" },
                    metalTraders: { name: "VC Networkers" }
                },
                transport: {
                    carts: { name: "Fiber Lines" },
                    wagons: { name: "CDN Networks" },
                    trains: { name: "Satellite Links" }
                },
                city: {
                    police: { name: "Security Team" },
                    banks: { name: "Accounting Dept" },
                    markets: { name: "App Stores" },
                    universities: { name: "R&D Labs" },
                    politicians: { name: "Lobbyists" },
                    salesDepartment: { name: "Sales Department" },
                    miningAcademy: { name: "Dev Bootcamp" },
                    automationLab: { name: "Automation Lab" }
                },
                crafting: {
                    basic: { 
                        title: "Compile Code", 
                        emoji: "⚙️",
                        result: "Deployable App",
                        inputs: "Code Commits"
                    },
                    intermediate: { 
                        title: "Build Platform", 
                        emoji: "🏗️",
                        result: "SaaS Platform",
                        inputs: "App + Servers"
                    },
                    advanced: { 
                        title: "Scale Service", 
                        emoji: "📊",
                        result: "Enterprise Product",
                        inputs: "Platform + Users"
                    },
                    premium: { 
                        title: "Launch Unicorn", 
                        emoji: "⭐",
                        result: "Unicorn Startup",
                        inputs: "Product + Premium Subs"
                    }
                },
                tabs: {
                    mining: { name: "Development", emoji: "💻" },
                    processing: { name: "Crafting", emoji: "🔨" },
                    market: { name: "Marketplace", emoji: "🏪" },
                    transport: { name: "Infrastructure", emoji: "🌐" },
                    city: { name: "Corporate", emoji: "🏢" },
                    research: { name: "R&D", emoji: "🔬" }
                },
                research: {
                    mining: { name: "Advanced Development", description: "+25% development efficiency" },
                    processing: { name: "Advanced Deployment", description: "+25% deployment efficiency" },
                    automation: { name: "CI/CD Pipeline", description: "Unlock automated systems" },
                    logistics: { name: "Cloud Infrastructure", description: "+50% infrastructure efficiency" }
                },
                unlocks: {
                    unlock_coal: { title: "Unlock Cloud Servers", description: "Unlock 2nd resource tier" },
                    unlock_iron: { title: "Unlock User Accounts", description: "Unlock 3rd resource tier" },
                    unlock_silver: { title: "Unlock Premium Subs", description: "Unlock 4th resource tier" },
                    unlock_processing: { title: "Unlock Deployment", description: "Unlock production buildings" }
                },
                rebirthButton: { text: "Rebirth Empire", emoji: "🔄" }
            },
            {
                // Rebirth 1 - Grocery Store Chain
                id: 1,
                name: "Retail Chain",
                description: "The tech empire collapsed. Now you run a grocery store chain",
                atmosphere: "neutral",
                colorScheme: {
                    primary: "#ffd700",
                    secondary: "#ffb347",
                    background: "linear-gradient(135deg, #2c3e50, #34495e, #2c3e50)"
                },
                resources: {
                    stone: { name: "Produce", emoji: "🥬", description: "Fresh vegetables" },
                    coal: { name: "Canned Goods", emoji: "🥫", description: "Preserved food" },
                    iron: { name: "Frozen Items", emoji: "🧊", description: "Frozen products" },
                    silver: { name: "Premium Brands", emoji: "🏆", description: "Luxury items" },
                    gold: { name: "Cash", emoji: "💵", description: "Store revenue" }
                },
                workers: {
                    stoneMiners: { name: "Stock Clerks", emoji: "📦" },
                    coalMiners: { name: "Cashiers", emoji: "🛒" },
                    ironMiners: { name: "Butchers", emoji: "🔪" },
                    silverMiners: { name: "Department Mgrs", emoji: "👔" }
                },
                processors: {
                    smelters: { name: "Prep Kitchen", description: "Processes fresh produce" },
                    forges: { name: "Bakery", description: "Bakes fresh goods" },
                    refineries: { name: "Deli Counter", description: "Prepares premium items" },
                    mints: { name: "Corporate HQ", description: "Manages franchises" }
                },
                traders: {
                    stoneTraders: { name: "Farmers Market Vendors" },
                    coalTraders: { name: "Wholesale Buyers" },
                    metalTraders: { name: "Supply Chain Mgrs" }
                },
                transport: {
                    carts: { name: "Shopping Carts" },
                    wagons: { name: "Delivery Vans" },
                    trains: { name: "Supply Trucks" }
                },
                city: {
                    police: { name: "Security Guards" },
                    banks: { name: "Credit Unions" },
                    markets: { name: "Farmer's Markets" },
                    universities: { name: "culinary school" },
                    politicians: { name: "Health Inspectors" },
                    salesDepartment: { name: "Marketing Team" },
                    miningAcademy: { name: "Training Program" },
                    automationLab: { name: "Logistics Center" }
                },
                crafting: {
                    basic: { 
                        title: "Wash Produce", 
                        emoji: "🧺",
                        result: "Fresh Salads",
                        inputs: "Produce"
                    },
                    intermediate: { 
                        title: "Prepare Meals", 
                        emoji: "👨‍🍳",
                        result: "Ready Meals",
                        inputs: "Salad + Canned Goods"
                    },
                    advanced: { 
                        title: "Create Combo", 
                        emoji: "🍱",
                        result: "Family Packs",
                        inputs: "Meal + Frozen"
                    },
                    premium: { 
                        title: "Gourmet Basket", 
                        emoji: "🧺",
                        result: "Gift Baskets",
                        inputs: "Pack + Premium"
                    }
                },
                tabs: {
                    mining: { name: "Sourcing", emoji: "📦" },
                    processing: { name: "Food Prep", emoji: "🍽️" },
                    market: { name: "Sales Floor", emoji: "🛒" },
                    transport: { name: "Logistics", emoji: "🚚" },
                    city: { name: "Corporate", emoji: "🏢" },
                    research: { name: "R&D", emoji: "📊" }
                },
                research: {
                    mining: { name: "Supply Chain Optimization", description: "+25% sourcing efficiency" },
                    processing: { name: "Kitchen Efficiency", description: "+25% food prep speed" },
                    automation: { name: "Self-Checkout Systems", description: "Unlock automated sales" },
                    logistics: { name: "Warehouse Management", description: "+50% logistics efficiency" }
                },
                unlocks: {
                    unlock_coal: { title: "Unlock Canned Goods", description: "Unlock 2nd product line" },
                    unlock_iron: { title: "Unlock Frozen Items", description: "Unlock 3rd product line" },
                    unlock_silver: { title: "Unlock Premium Brands", description: "Unlock 4th product line" },
                    unlock_processing: { title: "Unlock Food Prep", description: "Unlock kitchen facilities" }
                },
                rebirthButton: { text: "Close Chain", emoji: "🔄" }
            },
            {
                // Rebirth 2 - Mining Company
                id: 2,
                name: "Mining Corporation",
                description: "The stores failed. Back to extracting raw materials from the earth",
                atmosphere: "dim",
                colorScheme: {
                    primary: "#8b7355",
                    secondary: "#654321",
                    background: "linear-gradient(135deg, #3a3a3a, #2b2b2b, #1a1a1a)"
                },
                resources: {
                    stone: { name: "Raw Ore", emoji: "⛏️", description: "Unprocessed minerals" },
                    coal: { name: "Coal Seams", emoji: "⚫", description: "Fossil fuel" },
                    iron: { name: "Iron Deposits", emoji: "🔩", description: "Metal ore" },
                    silver: { name: "Precious Metals", emoji: "🥈", description: "Rare minerals" },
                    gold: { name: "Company Funds", emoji: "💰", description: "Operating capital" }
                },
                workers: {
                    stoneMiners: { name: "Shaft Miners", emoji: "⛏️" },
                    coalMiners: { name: "Coal Workers", emoji: "🔦" },
                    ironMiners: { name: "Ore Extractors", emoji: "🚜" },
                    silverMiners: { name: "Prospectors", emoji: "💎" }
                },
                processors: {
                    smelters: { name: "Ore Crusher", description: "Crushes raw ore" },
                    forges: { name: "Blast Furnace", description: "Smelts metal" },
                    refineries: { name: "Refinery", description: "Purifies metals" },
                    mints: { name: "Metal Trader", description: "Sells refined products" }
                },
                traders: {
                    stoneTraders: { name: "Ore Brokers" },
                    coalTraders: { name: "Energy Traders" },
                    metalTraders: { name: "Metal Merchants" }
                },
                transport: {
                    carts: { name: "Mine Carts" },
                    wagons: { name: "Ore Trucks" },
                    trains: { name: "Freight Trains" }
                },
                city: {
                    police: { name: "Mine Security" },
                    banks: { name: "Credit Office" },
                    markets: { name: "Company Store" },
                    universities: { name: "Mining School" },
                    politicians: { name: "Union Bosses" },
                    salesDepartment: { name: "Sales Office" },
                    miningAcademy: { name: "Mining Academy" },
                    automationLab: { name: "Equipment Bay" }
                },
                crafting: {
                    basic: { 
                        title: "Crush Ore", 
                        emoji: "⚒️",
                        result: "Raw Ingots",
                        inputs: "Raw Ore"
                    },
                    intermediate: { 
                        title: "Smelt Metal", 
                        emoji: "🔥",
                        result: "Metal Bars",
                        inputs: "Ingots + Coal"
                    },
                    advanced: { 
                        title: "Forge Tools", 
                        emoji: "🔨",
                        result: "Steel Tools",
                        inputs: "Bars + Iron"
                    },
                    premium: { 
                        title: "Refine Precious", 
                        emoji: "💎",
                        result: "Pure Metals",
                        inputs: "Tools + Precious"
                    }
                },
                tabs: {
                    mining: { name: "Extraction", emoji: "⛏️" },
                    processing: { name: "Smelting", emoji: "🔥" },
                    market: { name: "Trading", emoji: "💰" },
                    transport: { name: "Transport", emoji: "🚛" },
                    city: { name: "Company Town", emoji: "🏘️" },
                    research: { name: "Prospecting", emoji: "🔍" }
                },
                research: {
                    mining: { name: "Advanced Prospecting", description: "+25% extraction efficiency" },
                    processing: { name: "Blast Furnace Tech", description: "+25% smelting efficiency" },
                    automation: { name: "Conveyor Systems", description: "Unlock automated mining" },
                    logistics: { name: "Rail Networks", description: "+50% transport efficiency" }
                },
                unlocks: {
                    unlock_coal: { title: "Unlock Coal Seams", description: "Unlock 2nd resource tier" },
                    unlock_iron: { title: "Unlock Iron Veins", description: "Unlock 3rd resource tier" },
                    unlock_silver: { title: "Unlock Silver Deposits", description: "Unlock 4th resource tier" },
                    unlock_processing: { title: "Unlock Smelting", description: "Unlock ore processing" }
                },
                rebirthButton: { text: "Abandon Mines", emoji: "🔄" }
            },
            {
                // Rebirth 3 - Small Factory
                id: 3,
                name: "Failing Factory",
                description: "The mines dried up. Running a struggling manufacturing plant",
                atmosphere: "dark",
                colorScheme: {
                    primary: "#696969",
                    secondary: "#505050",
                    background: "linear-gradient(135deg, #2b2b2b, #1c1c1c, #0d0d0d)"
                },
                resources: {
                    stone: { name: "Scrap Metal", emoji: "🔩", description: "Recycled materials" },
                    coal: { name: "Factory Power", emoji: "⚡", description: "Electricity" },
                    iron: { name: "Raw Materials", emoji: "📦", description: "Basic supplies" },
                    silver: { name: "Quality Parts", emoji: "⚙️", description: "Better components" },
                    gold: { name: "Savings", emoji: "💵", description: "Dwindling funds" }
                },
                workers: {
                    stoneMiners: { name: "Day Laborers", emoji: "👷" },
                    coalMiners: { name: "Machine Operators", emoji: "🔧" },
                    ironMiners: { name: "Assembly Workers", emoji: "🏭" },
                    silverMiners: { name: "Quality Control", emoji: "✅" }
                },
                processors: {
                    smelters: { name: "Scrap Sorter", description: "Organizes scrap" },
                    forges: { name: "Workshop", description: "Repairs parts" },
                    refineries: { name: "Assembly Line", description: "Builds products" },
                    mints: { name: "Sales Dept", description: "Sells to distributors" }
                },
                traders: {
                    stoneTraders: { name: "Scrap Dealers" },
                    coalTraders: { name: "Parts Suppliers" },
                    metalTraders: { name: "Distributors" }
                },
                transport: {
                    carts: { name: "Hand Carts" },
                    wagons: { name: "Old Trucks" },
                    trains: { name: "Rail Cars" }
                },
                city: {
                    police: { name: "Night Watchmen" },
                    banks: { name: "Loan Office" },
                    markets: { name: "Flea Markets" },
                    universities: { name: "Trade School" },
                    politicians: { name: "Tax Collectors" },
                    salesDepartment: { name: "Trading Post" },
                    miningAcademy: { name: "Workshop" },
                    automationLab: { name: "Forge" }
                },
                crafting: {
                    basic: { 
                        title: "Sort Scrap", 
                        emoji: "♻️",
                        result: "Sorted Parts",
                        inputs: "Scrap Metal"
                    },
                    intermediate: { 
                        title: "Repair Parts", 
                        emoji: "🔧",
                        result: "Fixed Components",
                        inputs: "Parts + Power"
                    },
                    advanced: { 
                        title: "Assemble Units", 
                        emoji: "🏭",
                        result: "Factory Goods",
                        inputs: "Components + Materials"
                    },
                    premium: { 
                        title: "Quality Check", 
                        emoji: "✅",
                        result: "Premium Products",
                        inputs: "Goods + Quality Parts"
                    }
                },
                tabs: {
                    mining: { name: "Scavenging", emoji: "🔩" },
                    processing: { name: "Assembly", emoji: "🏭" },
                    market: { name: "Wholesale", emoji: "📦" },
                    transport: { name: "Shipping", emoji: "🚚" },
                    city: { name: "Industrial Park", emoji: "🏗️" },
                    research: { name: "Efficiency", emoji: "⚙️" }
                },
                research: {
                    mining: { name: "Improved Sorting", description: "+25% scrap collection" },
                    processing: { name: "Assembly Optimization", description: "+25% production efficiency" },
                    automation: { name: "Robotic Arms", description: "Unlock automated assembly" },
                    logistics: { name: "Distribution Network", description: "+50% shipping efficiency" }
                },
                unlocks: {
                    unlock_coal: { title: "Unlock Rubber Parts", description: "Unlock 2nd material tier" },
                    unlock_iron: { title: "Unlock Electronics", description: "Unlock 3rd material tier" },
                    unlock_silver: { title: "Unlock Precision Tools", description: "Unlock 4th material tier" },
                    unlock_processing: { title: "Unlock Assembly", description: "Unlock production line" }
                },
                rebirthButton: { text: "Close Factory", emoji: "🔄" }
            },
            {
                // Rebirth 4 - Artisan Workshop
                id: 4,
                name: "Artisan Workshop",
                description: "Mass production failed. Now you craft things by hand",
                atmosphere: "darker",
                colorScheme: {
                    primary: "#8b4513",
                    secondary: "#654321",
                    background: "linear-gradient(135deg, #1c1c1c, #121212, #000000)"
                },
                resources: {
                    stone: { name: "Clay", emoji: "🪨", description: "Raw materials" },
                    coal: { name: "Charcoal", emoji: "🔥", description: "Fuel for fire" },
                    iron: { name: "Tools", emoji: "🔨", description: "Work implements" },
                    silver: { name: "Fine Crafts", emoji: "🎨", description: "Quality goods" },
                    gold: { name: "Coins", emoji: "🪙", description: "Bartered money" }
                },
                workers: {
                    stoneMiners: { name: "Apprentices", emoji: "🧑‍🎓" },
                    coalMiners: { name: "Craftspeople", emoji: "👨‍🎨" },
                    ironMiners: { name: "Blacksmiths", emoji: "⚒️" },
                    silverMiners: { name: "Artisans", emoji: "✨" }
                },
                processors: {
                    smelters: { name: "Kiln", description: "Fires clay" },
                    forges: { name: "Forge", description: "Shapes metal" },
                    refineries: { name: "Workbench", description: "Crafts items" },
                    mints: { name: "Master Artisan", description: "Creates masterpieces" }
                },
                traders: {
                    stoneTraders: { name: "Hawkers" },
                    coalTraders: { name: "Peddlers" },
                    metalTraders: { name: "Merchants" }
                },
                transport: {
                    carts: { name: "Wheelbarrows" },
                    wagons: { name: "Donkey Carts" },
                    trains: { name: "Caravans" }
                },
                city: {
                    police: { name: "Town Guards" },
                    banks: { name: "Moneylenders" },
                    markets: { name: "Market Stalls" },
                    universities: { name: "Guild Halls" },
                    politicians: { name: "Town Council" },
                    salesDepartment: { name: "Merchant Guild" },
                    miningAcademy: { name: "Craftsman School" },
                    automationLab: { name: "Mill" }
                },
                crafting: {
                    basic: { 
                        title: "Shape Materials", 
                        emoji: "🪚",
                        result: "Basic Crafts",
                        inputs: "Timber/Stone"
                    },
                    intermediate: { 
                        title: "Forge Items", 
                        emoji: "🔨",
                        result: "Fine Crafts",
                        inputs: "Crafts + Coal"
                    },
                    advanced: { 
                        title: "Create Art", 
                        emoji: "🎨",
                        result: "Artisan Goods",
                        inputs: "Fine + Materials"
                    },
                    premium: { 
                        title: "Masterwork", 
                        emoji: "✨",
                        result: "Masterpieces",
                        inputs: "Artisan + Quality"
                    }
                },
                tabs: {
                    mining: { name: "Gathering", emoji: "🪨" },
                    processing: { name: "Crafting", emoji: "🔨" },
                    market: { name: "Market", emoji: "🏪" },
                    transport: { name: "Delivery", emoji: "🛒" },
                    city: { name: "Village", emoji: "🏘️" },
                    research: { name: "Learning", emoji: "📚" }
                },
                research: {
                    mining: { name: "Better Tools", description: "+25% gathering efficiency" },
                    processing: { name: "Master Crafting", description: "+25% crafting quality" },
                    automation: { name: "Workshop Helpers", description: "Unlock apprentice system" },
                    logistics: { name: "Trade Routes", description: "+50% delivery speed" }
                },
                unlocks: {
                    unlock_coal: { title: "Unlock Charcoal", description: "Unlock 2nd resource tier" },
                    unlock_iron: { title: "Unlock Bronze", description: "Unlock 3rd resource tier" },
                    unlock_silver: { title: "Unlock Fine Metals", description: "Unlock 4th resource tier" },
                    unlock_processing: { title: "Unlock Crafting", description: "Unlock workshops" }
                },
                rebirthButton: { text: "Abandon Workshop", emoji: "🔄" }
            },
            {
                // Rebirth 5 - Street Vendor
                id: 5,
                name: "Street Vendor",
                description: "The workshop closed. You sell whatever you can find on the streets",
                atmosphere: "grim",
                colorScheme: {
                    primary: "#4a4a4a",
                    secondary: "#2a2a2a",
                    background: "linear-gradient(135deg, #0f0f0f, #050505, #000000)"
                },
                resources: {
                    stone: { name: "Junk", emoji: "🗑️", description: "Worthless items" },
                    coal: { name: "Firewood", emoji: "🪵", description: "Something to burn" },
                    iron: { name: "Scavenged Parts", emoji: "🔧", description: "Found objects" },
                    silver: { name: "Antiques", emoji: "🏺", description: "Valuable finds" },
                    gold: { name: "Cash", emoji: "💵", description: "Daily earnings" }
                },
                workers: {
                    stoneMiners: { name: "Dumpster Divers", emoji: "🗑️" },
                    coalMiners: { name: "Wood Gatherers", emoji: "🪓" },
                    ironMiners: { name: "Scavengers", emoji: "🔍" },
                    silverMiners: { name: "Pickers", emoji: "🧺" }
                },
                processors: {
                    smelters: { name: "Junk Sorter", description: "Separates trash" },
                    forges: { name: "Repair Station", description: "Fixes broken items" },
                    refineries: { name: "Clean & Polish", description: "Makes items sellable" },
                    mints: { name: "Fence", description: "Sells anything" }
                },
                traders: {
                    stoneTraders: { name: "Street Vendors" },
                    coalTraders: { name: "Black Market" },
                    metalTraders: { name: "Pawn Shops" }
                },
                transport: {
                    carts: { name: "Shopping Cart" },
                    wagons: { name: "Bike Cart" },
                    trains: { name: "Stolen Van" }
                },
                city: {
                    police: { name: "Corrupt Cops" },
                    banks: { name: "Loan Sharks" },
                    markets: { name: "Street Corners" },
                    universities: { name: "Soup Kitchen" },
                    politicians: { name: "Gang Leaders" },
                    salesDepartment: { name: "Fence Network" },
                    miningAcademy: { name: "Street Smarts" },
                    automationLab: { name: "Chop Shop" }
                },
                crafting: {
                    basic: { 
                        title: "Sort Junk", 
                        emoji: "♻️",
                        result: "Cleaned Items",
                        inputs: "Junk"
                    },
                    intermediate: { 
                        title: "Repair Stuff", 
                        emoji: "🔧",
                        result: "Working Items",
                        inputs: "Clean + Firewood"
                    },
                    advanced: { 
                        title: "Polish Up", 
                        emoji: "✨",
                        result: "Sellable Goods",
                        inputs: "Working + Parts"
                    },
                    premium: { 
                        title: "Fake Antiques", 
                        emoji: "🏺",
                        result: "Valuable Items",
                        inputs: "Goods + Antiques"
                    }
                },
                tabs: {
                    mining: { name: "Selling", emoji: "🛒" },
                    processing: { name: "Stocking", emoji: "📦" },
                    market: { name: "Hawking", emoji: "💵" },
                    transport: { name: "Moving", emoji: "🚶" },
                    city: { name: "Streets", emoji: "🏙️" },
                    research: { name: "Hustling", emoji: "💡" }
                },
                research: {
                    mining: { name: "Better Pitch", description: "+25% sales success" },
                    processing: { name: "Quick Repairs", description: "+25% item quality" },
                    automation: { name: "Side Deals", description: "Unlock passive income" },
                    logistics: { name: "Fast Routes", description: "+50% movement speed" }
                },
                unlocks: {
                    unlock_coal: { title: "Unlock Snacks", description: "Unlock 2nd product tier" },
                    unlock_iron: { title: "Unlock Electronics", description: "Unlock 3rd product tier" },
                    unlock_silver: { title: "Unlock Jewelry", description: "Unlock 4th product tier" },
                    unlock_processing: { title: "Unlock Storage Unit", description: "Unlock inventory space" }
                },
                rebirthButton: { text: "Lose Everything", emoji: "🔄" }
            },
            {
                // Rebirth 6 - Lone Scavenger
                id: 6,
                name: "Scavenger",
                description: "Society is crumbling. You wander alone, searching for survival",
                atmosphere: "bleak",
                colorScheme: {
                    primary: "#8b0000",
                    secondary: "#5a0000",
                    background: "linear-gradient(135deg, #1a0000, #0d0000, #000000)"
                },
                resources: {
                    stone: { name: "Rubble", emoji: "🪨", description: "Broken concrete" },
                    coal: { name: "Burnable Debris", emoji: "🔥", description: "Fuel for warmth" },
                    iron: { name: "Useful Scraps", emoji: "🔩", description: "Tools & weapons" },
                    silver: { name: "Clean Water", emoji: "💧", description: "Drinkable water" },
                    gold: { name: "Canned Food", emoji: "🥫", description: "Preserved food" }
                },
                workers: {
                    stoneMiners: { name: "Other Survivors", emoji: "🚶" },
                    coalMiners: { name: "Wanderers", emoji: "🎒" },
                    ironMiners: { name: "Foragers", emoji: "🔍" },
                    silverMiners: { name: "Traders", emoji: "🤝" }
                },
                processors: {
                    smelters: { name: "Campfire", description: "Purifies water" },
                    forges: { name: "Makeshift Shelter", description: "Protection from elements" },
                    refineries: { name: "Tool Bench", description: "Repairs equipment" },
                    mints: { name: "Trade Post", description: "Barters with others" }
                },
                traders: {
                    stoneTraders: { name: "Nomads" },
                    coalTraders: { name: "Drifters" },
                    metalTraders: { name: "Survivors" }
                },
                transport: {
                    carts: { name: "Backpack" },
                    wagons: { name: "Handcart" },
                    trains: { name: "Bicycle" }
                },
                city: {
                    police: { name: "Militia" },
                    banks: { name: "Hidden Stash" },
                    markets: { name: "Ruins" },
                    universities: { name: "Library Ruins" },
                    politicians: { name: "Warlords" },
                    salesDepartment: { name: "Barter Post" },
                    miningAcademy: { name: "Survival Camp" },
                    automationLab: { name: "Scrap Yard" }
                },
                crafting: {
                    basic: { 
                        title: "Break Down", 
                        emoji: "🔨",
                        result: "Useful Parts",
                        inputs: "Rubble"
                    },
                    intermediate: { 
                        title: "Make Tools", 
                        emoji: "🔧",
                        result: "Crude Tools",
                        inputs: "Parts + Debris"
                    },
                    advanced: { 
                        title: "Build Shelter", 
                        emoji: "🏚️",
                        result: "Safe Spaces",
                        inputs: "Tools + Scraps"
                    },
                    premium: { 
                        title: "Purify Resources", 
                        emoji: "💧",
                        result: "Survival Kit",
                        inputs: "Shelter + Water"
                    }
                },
                tabs: {
                    mining: { name: "Scavenging", emoji: "🔍" },
                    processing: { name: "Surviving", emoji: "🔥" },
                    market: { name: "Bartering", emoji: "🤝" },
                    transport: { name: "Wandering", emoji: "🚶" },
                    city: { name: "Wasteland", emoji: "🏚️" },
                    research: { name: "Remembering", emoji: "📖" }
                },
                research: {
                    mining: { name: "Resource Finding", description: "+25% scavenging success" },
                    processing: { name: "Purification", description: "+25% salvage quality" },
                    automation: { name: "Traps & Snares", description: "Unlock passive gathering" },
                    logistics: { name: "Safe Routes", description: "+50% travel efficiency" }
                },
                unlocks: {
                    unlock_coal: { title: "Find Fuel", description: "Unlock 2nd resource tier" },
                    unlock_iron: { title: "Find Tools", description: "Unlock 3rd resource tier" },
                    unlock_silver: { title: "Find Medicine", description: "Unlock 4th resource tier" },
                    unlock_processing: { title: "Build Shelter", description: "Unlock basic crafting" }
                },
                rebirthButton: { text: "Give Up Hope", emoji: "💔" }
            },
            {
                // Rebirth 7 - Hermit
                id: 7,
                name: "Isolated Hermit",
                description: "Everyone is gone. You're alone in the wasteland",
                atmosphere: "desolate",
                colorScheme: {
                    primary: "#4a4a4a",
                    secondary: "#2a2a2a",
                    background: "linear-gradient(135deg, #000000, #0a0a0a, #000000)"
                },
                resources: {
                    stone: { name: "Rocks", emoji: "🪨", description: "Just... rocks" },
                    coal: { name: "Kindling", emoji: "🍂", description: "Dried leaves" },
                    iron: { name: "Broken Metal", emoji: "⚙️", description: "Rusty fragments" },
                    silver: { name: "Memories", emoji: "💭", description: "Better times" },
                    gold: { name: "Will to Live", emoji: "💔", description: "Fading hope" }
                },
                workers: {
                    stoneMiners: { name: "Hallucinations", emoji: "👻" },
                    coalMiners: { name: "Echoes", emoji: "🌫️" },
                    ironMiners: { name: "Shadows", emoji: "🌑" },
                    silverMiners: { name: "Ghosts", emoji: "👤" }
                },
                processors: {
                    smelters: { name: "Fire Pit", description: "Warmth in darkness" },
                    forges: { name: "Cave", description: "Shelter from nothing" },
                    refineries: { name: "Workbench", description: "Pointless repairs" },
                    mints: { name: "Talking to Yourself", description: "No one listens" }
                },
                traders: {
                    stoneTraders: { name: "The Wind" },
                    coalTraders: { name: "The Void" },
                    metalTraders: { name: "Silence" }
                },
                transport: {
                    carts: { name: "Feet" },
                    wagons: { name: "Walking Stick" },
                    trains: { name: "Nowhere to Go" }
                },
                city: {
                    police: { name: "Paranoia" },
                    banks: { name: "Empty Caches" },
                    markets: { name: "Abandoned Buildings" },
                    universities: { name: "Burned Books" },
                    politicians: { name: "Madness" },
                    salesDepartment: { name: "Ghost Market" },
                    miningAcademy: { name: "Forgotten Skills" },
                    automationLab: { name: "Broken Machines" }
                },
                crafting: {
                    basic: { 
                        title: "Find Twigs", 
                        emoji: "🌿",
                        result: "Kindling",
                        inputs: "Sticks"
                    },
                    intermediate: { 
                        title: "Make Fire", 
                        emoji: "🔥",
                        result: "Warmth",
                        inputs: "Kindling + Moss"
                    },
                    advanced: { 
                        title: "Boil Water", 
                        emoji: "💧",
                        result: "Clean Water",
                        inputs: "Warmth + Mud"
                    },
                    premium: { 
                        title: "Will to Continue", 
                        emoji: "💔",
                        result: "Another Day",
                        inputs: "Water + Hope"
                    }
                },
                tabs: {
                    mining: { name: "Foraging", emoji: "🌾" },
                    processing: { name: "Existing", emoji: "💭" },
                    market: { name: "Nothing", emoji: "∅" },
                    transport: { name: "Crawling", emoji: "🐌" },
                    city: { name: "Solitude", emoji: "🌑" },
                    research: { name: "Reflecting", emoji: "🪞" }
                },
                research: {
                    mining: { name: "Foraging Skills", description: "+25% survival chances" },
                    processing: { name: "Fire Making", description: "+25% warmth retained" },
                    automation: { name: "Shelter Building", description: "Unlock basic shelter" },
                    logistics: { name: "Memory Mapping", description: "+50% navigation" }
                },
                unlocks: {
                    unlock_coal: { title: "Find Warmth", description: "Remember fire" },
                    unlock_iron: { title: "Find Strength", description: "Remember tools" },
                    unlock_silver: { title: "Find Hope", description: "Remember beauty" },
                    unlock_processing: { title: "Find Purpose", description: "Remember creation" }
                },
                rebirthButton: { text: "Collapse", emoji: "😞" }
            },
            {
                // Rebirth 8 - Hospital Bed
                id: 8,
                name: "Hospital Bed",
                description: "You wake up in a hospital. Was it all a dream? Are you dying?",
                atmosphere: "sterile",
                colorScheme: {
                    primary: "#1e3a8a",
                    secondary: "#2563eb",
                    background: "linear-gradient(135deg, #f5f5f5, #e8e8e8, #d0d0d0)",
                    textColor: "#1e293b",
                    textColorSecondary: "#334155"
                },
                resources: {
                    stone: { name: "Strength", emoji: "💪", description: "Physical energy" },
                    coal: { name: "Breath", emoji: "💨", description: "Life force" },
                    iron: { name: "Consciousness", emoji: "🧠", description: "Mental clarity" },
                    silver: { name: "Hope", emoji: "✨", description: "Reason to live" },
                    gold: { name: "Time", emoji: "⏰", description: "Minutes remaining" }
                },
                workers: {
                    stoneMiners: { name: "Nurses", emoji: "👩‍⚕️" },
                    coalMiners: { name: "Doctors", emoji: "👨‍⚕️" },
                    ironMiners: { name: "Therapists", emoji: "🧑‍⚕️" },
                    silverMiners: { name: "Visitors", emoji: "👥" }
                },
                processors: {
                    smelters: { name: "IV Drip", description: "Sustains life" },
                    forges: { name: "Heart Monitor", description: "Beep... beep..." },
                    refineries: { name: "Medication", description: "Dulls the pain" },
                    mints: { name: "Life Support", description: "Keeps you breathing" }
                },
                traders: {
                    stoneTraders: { name: "Hospital Staff" },
                    coalTraders: { name: "Chaplain" },
                    metalTraders: { name: "Family" }
                },
                transport: {
                    carts: { name: "Wheelchair" },
                    wagons: { name: "Hospital Bed" },
                    trains: { name: "Ambulance" }
                },
                city: {
                    police: { name: "Security" },
                    banks: { name: "Insurance" },
                    markets: { name: "Gift Shop" },
                    universities: { name: "Medical Library" },
                    politicians: { name: "Hospital Admin" },
                    salesDepartment: { name: "Billing Dept" },
                    miningAcademy: { name: "Nurse Training" },
                    automationLab: { name: "Pharmacy" }
                },
                crafting: {
                    basic: { 
                        title: "Breathe", 
                        emoji: "💨",
                        result: "Moments",
                        inputs: "Breaths"
                    },
                    intermediate: { 
                        title: "Remember", 
                        emoji: "💭",
                        result: "Memories",
                        inputs: "Moments + Medication"
                    },
                    advanced: { 
                        title: "Accept", 
                        emoji: "🕊️",
                        result: "Peace",
                        inputs: "Memories + Therapy"
                    },
                    premium: { 
                        title: "Let Go", 
                        emoji: "✨",
                        result: "Closure",
                        inputs: "Peace + Visitors"
                    }
                },
                tabs: {
                    mining: { name: "Breathing", emoji: "💨" },
                    processing: { name: "Medications", emoji: "💊" },
                    market: { name: "Visitors", emoji: "👥" },
                    transport: { name: "Rounds", emoji: "🚑" },
                    city: { name: "Ward", emoji: "🏥" },
                    research: { name: "Prognosis", emoji: "📋" }
                },
                research: {
                    mining: { name: "Breathing Exercises", description: "+25% oxygen retention" },
                    processing: { name: "Medication Management", description: "+25% pain relief" },
                    automation: { name: "Acceptance", description: "Unlock peace" },
                    logistics: { name: "Final Wishes", description: "+50% comfort" }
                },
                unlocks: {
                    unlock_coal: { title: "Try to Eat", description: "Struggle for nutrition" },
                    unlock_iron: { title: "Try to Move", description: "Struggle for mobility" },
                    unlock_silver: { title: "Try to Remember", description: "Struggle for memory" },
                    unlock_processing: { title: "Try to Live", description: "Struggle for survival" }
                },
                rebirthButton: { text: "Let Go", emoji: "☮️" }
            },
            {
                // Rebirth 9 - Final Stage: Euthanasia
                id: 9,
                name: "The End",
                description: "There is no more struggle. Only peace awaits.",
                atmosphere: "void",
                colorScheme: {
                    primary: "#000000",
                    secondary: "#1a1a1a",
                    background: "linear-gradient(135deg, #000000, #000000, #000000)"
                },
                resources: {
                    stone: { name: "Regrets", emoji: "💔", description: "What could have been" },
                    coal: { name: "Memories", emoji: "📷", description: "Fading images" },
                    iron: { name: "Pain", emoji: "😢", description: "All you feel" },
                    silver: { name: "Acceptance", emoji: "🕊️", description: "Making peace" },
                    gold: { name: "Goodbye", emoji: "👋", description: "Farewell" }
                },
                workers: {
                    stoneMiners: { name: "Loved Ones", emoji: "❤️" },
                    coalMiners: { name: "Friends", emoji: "🤝" },
                    ironMiners: { name: "Dreams", emoji: "💭" },
                    silverMiners: { name: "Legacy", emoji: "📖" }
                },
                processors: {
                    smelters: { name: "Reflection", description: "Looking back" },
                    forges: { name: "Forgiveness", description: "Letting go" },
                    refineries: { name: "Gratitude", description: "For what was" },
                    mints: { name: "Peace", description: "Finally" }
                },
                traders: {
                    stoneTraders: { name: "The Past" },
                    coalTraders: { name: "The Present" },
                    metalTraders: { name: "The Unknown" }
                },
                transport: {
                    carts: { name: "Journey" },
                    wagons: { name: "Path" },
                    trains: { name: "Destination" }
                },
                city: {
                    police: { name: "Fear" },
                    banks: { name: "Worth" },
                    markets: { name: "Life" },
                    universities: { name: "Wisdom" },
                    politicians: { name: "Fate" },
                    salesDepartment: { name: "Purpose" },
                    miningAcademy: { name: "Growth" },
                    automationLab: { name: "Flow" }
                },
                crafting: {
                    basic: { 
                        title: "Feel", 
                        emoji: "💓",
                        result: "Sensation",
                        inputs: "Heartbeats"
                    },
                    intermediate: { 
                        title: "Recall", 
                        emoji: "✨",
                        result: "Flashbacks",
                        inputs: "Sensation + Thoughts"
                    },
                    advanced: { 
                        title: "Understand", 
                        emoji: "🌟",
                        result: "Meaning",
                        inputs: "Flashbacks + Wisdom"
                    },
                    premium: { 
                        title: "Release", 
                        emoji: "🕊️",
                        result: "Transcendence",
                        inputs: "Meaning + Peace"
                    }
                },
                tabs: {
                    mining: { name: "Heartbeat", emoji: "💓" },
                    processing: { name: "Fading", emoji: "🌫️" },
                    market: { name: "Memories", emoji: "✨" },
                    transport: { name: "Drifting", emoji: "☁️" },
                    city: { name: "Peace", emoji: "☮️" },
                    research: { name: "Release", emoji: "🕊️" }
                },
                research: {
                    mining: { name: "Cherished Memories", description: "+25% remembrance" },
                    processing: { name: "Forgiveness", description: "+25% inner peace" },
                    automation: { name: "Gratitude", description: "Unlock appreciation" },
                    logistics: { name: "Final Release", description: "+50% serenity" }
                },
                unlocks: {
                    unlock_coal: { title: "Accept", description: "Accept what comes" },
                    unlock_iron: { title: "Forgive", description: "Forgive yourself" },
                    unlock_silver: { title: "Love", description: "Love what was" },
                    unlock_processing: { title: "Release", description: "Let everything go" }
                },
                rebirthButton: { text: "Euthanasia", emoji: "☠️" },
                isEnding: true
            },
            
            // Rebirth 10 - The Final End (Golden Chest Only)
            {
                id: 10,
                name: "✨ The End ✨",
                description: "Beyond the void, only the golden reward remains...",
                tabs: {
                    city: { name: "✨ Eternity", emoji: "✨" },
                    factory: { name: "✨ Nothing", emoji: "✨" },
                    transport: { name: "✨ Still", emoji: "✨" },
                    resources: { name: "✨ Void", emoji: "✨" }
                },
                resources: {
                    basic: { name: "✨ Memory", emoji: "✨", source: "The Past" },
                    intermediate: { name: "✨ Dream", emoji: "✨", source: "The Void" }
                },
                workers: {
                    gatherer: { name: "✨ Ghost", emoji: "👻" },
                    crafter: { name: "✨ Echo", emoji: "👤" }
                },
                crafting: {
                    basic: { 
                        name: "✨ Sparkle",
                        result: "✨ Sparkle",
                        emoji: "✨"
                    },
                    intermediate: { 
                        name: "✨ Glimmer",
                        result: "✨ Glimmer",
                        emoji: "✨"
                    },
                    advanced: { 
                        name: "✨ Shine",
                        result: "✨ Shine",
                        emoji: "✨"
                    },
                    premium: { 
                        name: "✨ Radiance",
                        result: "✨ Radiance",
                        emoji: "✨"
                    }
                },
                transport: {
                    basic: { name: "✨ Drift", emoji: "✨" },
                    intermediate: { name: "✨ Float", emoji: "✨" },
                    advanced: { name: "✨ Glide", emoji: "✨" }
                },
                upgrades: {
                    efficiency: "✨ Transcendence",
                    speed: "✨ Timelessness"
                },
                rebirthButton: { text: "✨ Final Rest", emoji: "✨" },
                isEnding: true,
                hideAllUI: true  // Special flag to hide everything except golden chest
            }
        ];
    }

    getTheme(rebirthCount) {
        // Cap at final theme
        const index = Math.min(rebirthCount, this.themes.length - 1);
        return this.themes[index];
    }

    getCurrentTheme(gameState) {
        const rebirths = gameState.city?.rebirths || 0;
        return this.getTheme(rebirths);
    }

    isGameEnded(gameState) {
        const rebirths = gameState.city?.rebirths || 0;
        const theme = this.getTheme(rebirths);
        return theme.isEnding || false;
    }
}

// Export for use in other modules
window.RebirthThemes = RebirthThemes;
