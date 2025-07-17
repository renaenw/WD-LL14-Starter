// Helper function to create option elements
function createOption(value, text) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = text;
  return option;
}

// Populate all dropdowns when the page loads
window.addEventListener("DOMContentLoaded", async function () {
  // Get dropdown elements
  const areaSelect = document.getElementById("area-select");
  const categorySelect = document.getElementById("category-select");
  const ingredientSelect = document.getElementById("ingredient-select");

  // Reset dropdowns
  areaSelect.innerHTML = '<option value="">Select Area</option>';
  categorySelect.innerHTML = '<option value="">Select Category</option>';
  ingredientSelect.innerHTML = '<option value="">Select Ingredient</option>';

  // Fetch and populate Area dropdown
  try {
    const areaRes = await fetch(
      "https://www.themealdb.com/api/json/v1/1/list.php?a=list"
    );
    const areaData = await areaRes.json();
    if (areaData.meals) {
      areaData.meals.forEach((areaObj) => {
        areaSelect.appendChild(createOption(areaObj.strArea, areaObj.strArea));
      });
    }
  } catch (err) {
    console.error("Error loading areas", err);
  }

  // Fetch and populate Category dropdown
  try {
    const catRes = await fetch(
      "https://www.themealdb.com/api/json/v1/1/list.php?c=list"
    );
    const catData = await catRes.json();
    if (catData.meals) {
      catData.meals.forEach((catObj) => {
        categorySelect.appendChild(
          createOption(catObj.strCategory, catObj.strCategory)
        );
      });
    }
  } catch (err) {
    console.error("Error loading categories", err);
  }

  // Fetch and populate Ingredient dropdown
  try {
    const ingRes = await fetch(
      "https://www.themealdb.com/api/json/v1/1/list.php?i=list"
    );
    const ingData = await ingRes.json();
    if (ingData.meals) {
      ingData.meals.forEach((ingObj) => {
        ingredientSelect.appendChild(
          createOption(ingObj.strIngredient, ingObj.strIngredient)
        );
      });
    }
  } catch (err) {
    console.error("Error loading ingredients", err);
  }
});

// Function to fetch and display meals based on all selected filters
async function fetchAndDisplayMeals() {
  // Get filter values
  const area = document.getElementById("area-select").value;
  const category = document.getElementById("category-select").value;
  const ingredient = document.getElementById("ingredient-select").value;
  const name = document.getElementById("name-input").value.trim();
  const resultsDiv = document.getElementById("results");

  // Remove any existing detail section
  const oldDetail = document.getElementById("meal-detail");
  if (oldDetail) {
    oldDetail.remove();
  }

  resultsDiv.innerHTML = ""; // Clear previous results

  // If no filters are selected, do not show anything
  if (!area && !category && !ingredient && !name) {
    return;
  }

  // Helper function to get meal IDs from a filter endpoint
  async function getMealIdsByFilter(url) {
    try {
      const res = await fetch(url);
      const data = await res.json();
      if (!data.meals) return [];
      return data.meals.map((meal) => meal.idMeal);
    } catch {
      return [];
    }
  }

  // Collect sets of meal IDs for each filter (except name)
  let idSets = [];

  if (area) {
    const ids = await getMealIdsByFilter(
      `https://www.themealdb.com/api/json/v1/1/filter.php?a=${encodeURIComponent(
        area
      )}`
    );
    idSets.push(new Set(ids));
  }
  if (category) {
    const ids = await getMealIdsByFilter(
      `https://www.themealdb.com/api/json/v1/1/filter.php?c=${encodeURIComponent(
        category
      )}`
    );
    idSets.push(new Set(ids));
  }
  if (ingredient) {
    const ids = await getMealIdsByFilter(
      `https://www.themealdb.com/api/json/v1/1/filter.php?i=${encodeURIComponent(
        ingredient
      )}`
    );
    idSets.push(new Set(ids));
  }

  // If searching by name, get all meals matching the name (full objects)
  let meals = [];
  if (name) {
    try {
      const res = await fetch(
        `https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(
          name
        )}`
      );
      const data = await res.json();
      if (data.meals) {
        meals = data.meals;
      }
    } catch {
      meals = [];
    }
  } else {
    // If not searching by name, get all meal IDs from the intersection of filters
    if (idSets.length === 0) {
      // No filters selected (should not happen here)
      return;
    }
    // Intersect all sets to get only meals matching all filters
    let intersection = idSets[0];
    for (let i = 1; i < idSets.length; i++) {
      intersection = new Set(
        [...intersection].filter((id) => idSets[i].has(id))
      );
    }
    // Fetch meal details for each id in the intersection, in parallel for speed
    const mealDetailPromises = [];
    for (const id of intersection) {
      mealDetailPromises.push(
        (async () => {
          try {
            const res = await fetch(
              `https://www.themealdb.com/api/json/v1/1/lookup.php?i=${id}`
            );
            const data = await res.json();
            if (data.meals && data.meals[0]) {
              return data.meals[0];
            }
          } catch {
            // skip errors
          }
          return null;
        })()
      );
    }
    // Wait for all meal detail fetches to finish
    const mealDetails = await Promise.all(mealDetailPromises);
    // Only keep valid meals
    meals = mealDetails.filter((meal) => meal);
  }

  // If no meals found, show message
  if (!meals || meals.length === 0) {
    resultsDiv.textContent = "No meals found for this filter.";
    return;
  }

  // If all filters are used (including name), filter the meals array further
  if (name && (area || category || ingredient)) {
    meals = meals.filter((meal) => {
      let match = true;
      if (area) match = match && meal.strArea === area;
      if (category) match = match && meal.strCategory === category;
      if (ingredient) {
        // Check if any ingredient matches the selected ingredient
        let found = false;
        for (let i = 1; i <= 20; i++) {
          if (
            meal[`strIngredient${i}`] &&
            meal[`strIngredient${i}`].toLowerCase() === ingredient.toLowerCase()
          ) {
            found = true;
            break;
          }
        }
        match = match && found;
      }
      return match;
    });
  }

  // Render the meal cards
  for (const meal of meals) {
    const mealDiv = document.createElement("div");
    mealDiv.className = "meal";

    const title = document.createElement("h3");
    title.textContent = meal.strMeal;

    // Show area on card if available
    if (meal.strArea) {
      const areaLabel = document.createElement("div");
      areaLabel.textContent = `Area: ${meal.strArea}`;
      areaLabel.style.fontSize = "0.95rem";
      areaLabel.style.color = "#ba68c8";
      areaLabel.style.marginBottom = "8px";
      areaLabel.style.textAlign = "center";
      mealDiv.appendChild(areaLabel);
    }

    const img = document.createElement("img");
    img.src = meal.strMealThumb;
    img.alt = meal.strMeal;

    // Add click event to fetch and show meal details
    mealDiv.addEventListener("click", async () => {
      // Remove 'selected' class from all meal cards
      document.querySelectorAll(".meal.selected").forEach((el) => {
        el.classList.remove("selected");
      });
      // Add 'selected' class to the clicked card
      mealDiv.classList.add("selected");

      // Fetch detailed info for this meal using its ID
      try {
        let mealDetail = meal;
        if (!meal.strInstructions) {
          // If not, fetch details by ID
          const detailRes = await fetch(
            `https://www.themealdb.com/api/json/v1/1/lookup.php?i=${meal.idMeal}`
          );
          const detailData = await detailRes.json();
          mealDetail = detailData.meals ? detailData.meals[0] : null;
        }
        if (!mealDetail) {
          alert("No details found for this meal.");
          return;
        }

        // Remove any existing detail section
        const oldDetail = document.getElementById("meal-detail");
        if (oldDetail) {
          oldDetail.remove();
        }

        // Create a new div to show meal details
        const detailDiv = document.createElement("div");
        detailDiv.id = "meal-detail";
        detailDiv.style.maxWidth = "900px";
        detailDiv.style.margin = "32px auto";
        detailDiv.style.background = "#fff";
        detailDiv.style.borderRadius = "8px";
        detailDiv.style.boxShadow = "0 2px 8px rgba(0,0,0,0.07)";
        detailDiv.style.padding = "24px";

        // Title
        const detailTitle = document.createElement("h2");
        detailTitle.textContent = mealDetail.strMeal;
        detailDiv.appendChild(detailTitle);

        // Image
        const detailImg = document.createElement("img");
        detailImg.src = mealDetail.strMealThumb;
        detailImg.alt = mealDetail.strMeal;
        detailImg.style.width = "100%";
        detailImg.style.maxWidth = "400px";
        detailImg.style.display = "block";
        detailImg.style.margin = "0 auto 16px auto";
        detailImg.style.borderRadius = "6px";
        detailDiv.appendChild(detailImg);

        // Ingredients list
        const ingredientsTitle = document.createElement("h3");
        ingredientsTitle.textContent = "Ingredients";
        detailDiv.appendChild(ingredientsTitle);

        const ingredientsList = document.createElement("ul");
        for (let i = 1; i <= 20; i++) {
          const ingredient = mealDetail[`strIngredient${i}`];
          const measure = mealDetail[`strMeasure${i}`];
          if (ingredient && ingredient.trim() !== "") {
            const li = document.createElement("li");
            li.textContent = `${ingredient}${
              measure && measure.trim() ? " - " + measure : ""
            }`;
            ingredientsList.appendChild(li);
          }
        }
        detailDiv.appendChild(ingredientsList);

        // Instructions
        const instructionsTitle = document.createElement("h3");
        instructionsTitle.textContent = "Instructions";
        detailDiv.appendChild(instructionsTitle);

        // Split instructions into bullet points
        const instructionsList = document.createElement("ul");
        const steps = mealDetail.strInstructions
          .split(/\r?\n|\. /)
          .map((step) => step.trim())
          .filter((step) => step.length > 0);

        for (const step of steps) {
          const li = document.createElement("li");
          li.textContent = step.endsWith(".") ? step : step + ".";
          instructionsList.appendChild(li);
        }
        detailDiv.appendChild(instructionsList);

        // Add the detailDiv to the page (above the results)
        resultsDiv.parentNode.insertBefore(detailDiv, resultsDiv);
      } catch (error) {
        console.error("Error fetching meal details:", error);
      }
    });

    mealDiv.appendChild(title);
    mealDiv.appendChild(img);
    resultsDiv.appendChild(mealDiv);
  }
}

// Add event listeners for all filters
document
  .getElementById("area-select")
  .addEventListener("change", fetchAndDisplayMeals);
document
  .getElementById("category-select")
  .addEventListener("change", fetchAndDisplayMeals);
document
  .getElementById("ingredient-select")
  .addEventListener("change", fetchAndDisplayMeals);
document.getElementById("name-input").addEventListener("input", function () {
  // Only search if at least 2 characters are entered for name
  if (this.value.trim().length === 0 || this.value.trim().length > 1) {
    fetchAndDisplayMeals();
  }
});

// Add event listener for the Random Recipe button
const randomBtn = document.getElementById("random-btn");
if (randomBtn) {
  randomBtn.addEventListener("click", async function () {
    // Get the results div
    const resultsDiv = document.getElementById("results");

    // Remove any existing detail section
    const oldDetail = document.getElementById("meal-detail");
    if (oldDetail) {
      oldDetail.remove();
    }

    // Clear previous results
    resultsDiv.innerHTML = "";

    try {
      // Fetch a random meal from the API
      const response = await fetch(
        "https://www.themealdb.com/api/json/v1/1/random.php"
      );
      const data = await response.json();
      const mealDetail = data.meals ? data.meals[0] : null;

      if (!mealDetail) {
        resultsDiv.textContent = "No random recipe found.";
        return;
      }

      // Create a new div to show meal details
      const detailDiv = document.createElement("div");
      detailDiv.id = "meal-detail";
      detailDiv.style.maxWidth = "900px";
      detailDiv.style.margin = "32px auto";
      detailDiv.style.background = "#fff";
      detailDiv.style.borderRadius = "8px";
      detailDiv.style.boxShadow = "0 2px 8px rgba(0,0,0,0.07)";
      detailDiv.style.padding = "24px";

      // Title
      const detailTitle = document.createElement("h2");
      detailTitle.textContent = mealDetail.strMeal;
      detailDiv.appendChild(detailTitle);

      // Show the area (region/cuisine)
      if (mealDetail.strArea) {
        const areaLabel = document.createElement("div");
        areaLabel.textContent = `Area: ${mealDetail.strArea}`;
        areaLabel.style.textAlign = "center";
        areaLabel.style.fontWeight = "bold";
        areaLabel.style.color = "#ba68c8";
        areaLabel.style.marginBottom = "12px";
        detailDiv.appendChild(areaLabel);
      }

      // Image
      const detailImg = document.createElement("img");
      detailImg.src = mealDetail.strMealThumb;
      detailImg.alt = mealDetail.strMeal;
      detailImg.style.width = "100%";
      detailImg.style.maxWidth = "400px";
      detailImg.style.display = "block";
      detailImg.style.margin = "0 auto 16px auto";
      detailImg.style.borderRadius = "6px";
      detailDiv.appendChild(detailImg);

      // Ingredients list
      const ingredientsTitle = document.createElement("h3");
      ingredientsTitle.textContent = "Ingredients";
      detailDiv.appendChild(ingredientsTitle);

      const ingredientsList = document.createElement("ul");
      // Loop through possible 20 ingredients
      for (let i = 1; i <= 20; i++) {
        const ingredient = mealDetail[`strIngredient${i}`];
        const measure = mealDetail[`strMeasure${i}`];
        if (ingredient && ingredient.trim() !== "") {
          const li = document.createElement("li");
          li.textContent = `${ingredient}${
            measure && measure.trim() ? " - " + measure : ""
          }`;
          ingredientsList.appendChild(li);
        }
      }
      detailDiv.appendChild(ingredientsList);

      // Instructions
      const instructionsTitle = document.createElement("h3");
      instructionsTitle.textContent = "Instructions";
      detailDiv.appendChild(instructionsTitle);

      // Split instructions into bullet points
      const instructionsList = document.createElement("ul");
      const steps = mealDetail.strInstructions
        .split(/\r?\n|\. /)
        .map((step) => step.trim())
        .filter((step) => step.length > 0);

      for (const step of steps) {
        const li = document.createElement("li");
        li.textContent = step.endsWith(".") ? step : step + ".";
        instructionsList.appendChild(li);
      }
      detailDiv.appendChild(instructionsList);

      // Add the detailDiv to the page (above the results)
      resultsDiv.parentNode.insertBefore(detailDiv, resultsDiv);
    } catch (error) {
      resultsDiv.textContent = "Error loading random recipe.";
      console.error("Error fetching random recipe:", error);
    }
  });
}

// Add event listener for the Clear Filters button
const clearBtn = document.getElementById("clear-btn");
if (clearBtn) {
  clearBtn.addEventListener("click", () => {
    // Reset all dropdowns and input to default values
    document.getElementById("area-select").value = "";
    document.getElementById("category-select").value = "";
    document.getElementById("ingredient-select").value = "";
    document.getElementById("name-input").value = "";

    // Remove any existing detail section
    const oldDetail = document.getElementById("meal-detail");
    if (oldDetail) {
      oldDetail.remove();
    }

    // Clear results
    const resultsDiv = document.getElementById("results");
    resultsDiv.innerHTML = "";
  });
}
