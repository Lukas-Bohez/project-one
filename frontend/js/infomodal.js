// Fetch items from API
const lanIP = `http://${window.location.hostname}`;

const fetchItems = async () => {
   try {
       console.log('Fetching items from API...');
       const response = await fetch(`${lanIP}/api/v1/items`);
       console.log('Response status:', response.status);
      
       if (!response.ok) {
           throw new Error(`HTTP error! status: ${response.status}`);
       }
      
       const data = await response.json();
       console.log('Received data:', data);
       return data.items || [];
   } catch (error) {
       console.error('Error fetching items:', error);
       return [];
   }
};

// Create HTML for a single item
const createItemHTML = (item) => {
   // Handle different possible property names
   const name = item.name || item.item_name || item.title || 'Unknown Item';
   const description = item.description || item.item_description || item.desc || 'No description available';
  
   return `<li class="c-items-list__item"><strong>${name}:</strong> ${description}</li>`;
};

// Update the items list in the modal
const updateItemsList = (items) => {
   // Find the items list specifically in the Items section
   const itemsSection = document.querySelector('.c-info-section h3[class="c-info-section__title"]');
   let itemsList = null;
  
   if (itemsSection && itemsSection.textContent.includes('Items')) {
       itemsList = itemsSection.parentElement.querySelector('.c-items-list');
   }
  
   // Fallback: find first items list
   if (!itemsList) {
       itemsList = document.querySelector('.c-items-list');
   }
  
   if (!itemsList) {
       console.error('Items list element not found');
       return;
   }
  
   console.log('Found items list element, updating with', items.length, 'items');
  
   // Clear existing items
   itemsList.innerHTML = '';
  
   // Add new items
   if (items && items.length > 0) {
       items.forEach(item => {
           itemsList.innerHTML += createItemHTML(item);
       });
   } else {
       itemsList.innerHTML = '<li class="c-items-list__item">No items available</li>';
   }
};

// Load and display items in the modal
const loadItemsIntoModal = async () => {
   console.log('Loading items into modal...');
   try {
       const items = await fetchItems();
       console.log('Fetched items:', items);
       updateItemsList(items);
   } catch (error) {
       console.error('Error loading items into modal:', error);
   }
};

// Modal functionality
const initializeModal = () => {
   const modal = document.getElementById('infoModal');
   const btn = document.getElementById('infoBtn');
   const closeBtn = document.querySelector('.c-modal__close');
   
   if (!modal || !btn) {
       console.error('Modal or button not found');
       return;
   }
   
   // Open modal when button is clicked
   btn.addEventListener('click', () => {
       modal.style.display = 'block';
       loadItemsIntoModal(); // Load items when modal opens
   });
   
   // Close modal when close button is clicked
   if (closeBtn) {
       closeBtn.addEventListener('click', () => {
           modal.style.display = 'none';
       });
   }
   
   // Close modal when clicking outside of it
   window.addEventListener('click', (event) => {
       if (event.target === modal) {
           modal.style.display = 'none';
       }
   });
};

// Initialize items when DOM is loaded
const initializeItems = () => {
   console.log('Initializing items...');
   initializeModal();
  
   // Wait a bit for DOM to be fully ready
   setTimeout(() => {
       loadItemsIntoModal();
   }, 100);
};

// Multiple ways to ensure initialization
document.addEventListener('DOMContentLoaded', initializeItems);

// Backup initialization
if (document.readyState === 'loading') {
   document.addEventListener('DOMContentLoaded', initializeItems);
} else {
   initializeItems();
}

// Manual function you can call from console for testing
const testItemsLoad = () => {
   console.log('Manual test triggered');
   loadItemsIntoModal();
};