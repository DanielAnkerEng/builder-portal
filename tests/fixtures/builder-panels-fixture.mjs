// Presentation-only navigation. No product controller, session, API or write path.
const tabs = [...document.querySelectorAll(".sidebar-tab")];
for (const tab of tabs) {
  tab.addEventListener("click", () => {
    for (const button of tabs) button.classList.toggle("active", button === tab);
    for (const panel of document.querySelectorAll(".panel")) panel.classList.toggle("active", panel.id === "panel-" + tab.dataset.tab);
  });
}
