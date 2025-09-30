// Make inline images in article pages dynamic via AI image provider
(function(){
  'use strict';

  function el(sel){ return document.querySelector(sel); }

  // Enhanced context analysis for better image relevance
  function buildContextualQuery(figure) {
    const img = figure.querySelector('img');
    if (!img) return '';

    // Get caption and heading context
    const caption = figure.querySelector('figcaption')?.textContent?.trim() || '';
    let headingText = '';
    let sectionText = '';

    // Find the preceding heading (h2/h3)
    let prev = figure.previousElementSibling;
    while (prev) {
      if (prev.tagName === 'H2' || prev.tagName === 'H3') {
        headingText = prev.textContent.trim();
        break;
      }
      // Collect nearby paragraph text for context
      if (prev.tagName === 'P' && sectionText.length < 200) {
        sectionText = prev.textContent.trim() + ' ' + sectionText;
      }
      prev = prev.previousElementSibling;
    }

    // Extract key concepts and visual descriptors
    const visualKeywords = extractVisualKeywords(headingText, caption, sectionText);
    return buildOptimizedQuery(headingText, caption, visualKeywords);
  }

  function extractVisualKeywords(heading, caption, context) {
    // Define concept-to-visual mappings for better relevance
    const conceptMap = {
      'housing': 'residential neighborhood, apartment buildings, real estate market',
      'healthcare': 'hospital, medical professionals, healthcare facility, stethoscope',
      'education': 'university campus, graduation ceremony, students studying, library',
      'monopoly': 'corporate headquarters, business district, boardroom meeting',
      'political': 'government building, capitol dome, political rally, democracy',
      'wealth': 'financial district, wall street, economic inequality, money',
      'inequality': 'rich vs poor contrast, economic disparity, social classes',
      'debt': 'financial stress, bills and paperwork, burden, chains',
      'costs': 'rising prices, inflation, expensive, budget strain',
      'growth': 'upward trending chart, statistics, data visualization'
    };

    const allText = `${heading} ${caption} ${context}`.toLowerCase();
    const foundConcepts = [];

    Object.entries(conceptMap).forEach(([concept, visuals]) => {
      if (allText.includes(concept)) {
        foundConcepts.push(visuals);
      }
    });

    return foundConcepts.join(', ');
  }

  function buildOptimizedQuery(heading, caption, visualKeywords) {
    // Prioritize visual descriptors over abstract concepts
    const styleKeywords = 'photojournalism, editorial photography, news photo, documentary style, professional lighting';
    
    // Build hierarchical query: specific visual concepts + style + context
    let query = '';
    
    if (visualKeywords) {
      query = `${visualKeywords}, ${styleKeywords}`;
    } else {
      // Fallback: use heading/caption but add visual context
      const cleanHeading = heading.replace(/[^\w\s]/g, '').trim();
      const cleanCaption = caption.replace(/[^\w\s]/g, '').trim();
      query = `${cleanHeading} ${cleanCaption} concept, ${styleKeywords}`;
    }

    // Ensure query is concise but descriptive
    return query.substring(0, 200);
  }

  function attachAIImages(){
    if(!window.imageProvider) return;
    
    const figures = document.querySelectorAll('figure');
    figures.forEach((fig) => {
      const img = fig.querySelector('img');
      if(!img) return;
      const hasExplicit = img.hasAttribute('data-ai-query');
      if(hasExplicit) return;

      const query = buildContextualQuery(fig);
      if(!query) return;
      
      console.log('Generated contextual query:', query); // Debug log
      img.setAttribute('data-ai-query', query);
    });

    window.imageProvider.populateInline();
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', attachAIImages);
  }else{
    attachAIImages();
  }
})();