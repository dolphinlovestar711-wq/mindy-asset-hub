/* =========================================================
   Mindy Asset Hub
   app.js
   ---------------------------------------------------------
   功能：
   1. 載入 assets.json
   2. Dashboard 統計
   3. 素材卡片
   4. 搜尋素材
   5. 類型 / 平台 / 尺寸篩選
   6. 排序
   7. 收藏素材
   8. 最近新增
   9. 專案篩選
   10. 標籤篩選
   11. 素材詳細資訊側欄
   12. 新增素材
   13. localStorage 保存新增素材與收藏
========================================================= */


/* =========================================================
   01. 全域資料
========================================================= */

let assets = [];
let filteredAssets = [];

let currentType = "all";
let currentPlatform = "all";
let currentSize = "all";
let currentProject = "all";
let currentTag = "all";
let currentSort = "newest";
let searchKeyword = "";


/* =========================================================
   02. DOM 載入完成
========================================================= */

document.addEventListener("DOMContentLoaded", async () => {

    console.log("Mindy Asset Hub 啟動");

    await loadAssets();

    loadFavorites();

    setupNavigation();

    setupSearch();

    setupFilters();

    setupSort();

    setupModal();

    setupDrawer();

    setupAddAssetForm();

    applyFilters();

});


/* =========================================================
   03. 載入 assets.json
========================================================= */

async function loadAssets() {

    try {

        const response = await fetch("data/assets.json");

        if (!response.ok) {
            throw new Error("assets.json 載入失敗");
        }

        const jsonData = await response.json();

        /*
        支援兩種 JSON 格式：

        [
            {...},
            {...}
        ]

        或

        {
            "assets": [
                {...},
                {...}
            ]
        }
        */

        if (Array.isArray(jsonData)) {

            assets = jsonData;

        } else if (Array.isArray(jsonData.assets)) {

            assets = jsonData.assets;

        } else {

            assets = [];

        }

        /*
        載入瀏覽器中自行新增的素材
        */

        const localAssets =
            JSON.parse(localStorage.getItem("mindyCustomAssets")) || [];

        assets = [...localAssets, ...assets];

        console.log("素材載入完成：", assets.length);

    }

    catch (error) {

        console.error(error);

        /*
        即使 JSON 載入失敗，
        仍然讀取瀏覽器自行新增的素材。
        */

        assets =
            JSON.parse(localStorage.getItem("mindyCustomAssets")) || [];

    }

}


/* =========================================================
   04. 收藏資料
========================================================= */

function getFavoriteIds() {

    return JSON.parse(
        localStorage.getItem("mindyFavoriteAssets")
    ) || [];

}


function loadFavorites() {

    const favoriteIds = getFavoriteIds();

    assets.forEach(asset => {

        /*
        如果 JSON 本身有 favorite:true，
        或 localStorage 有紀錄，
        都視為收藏。
        */

        asset.favorite =
            asset.favorite === true ||
            favoriteIds.includes(String(asset.id));

    });

}


/* =========================================================
   05. 收藏 / 取消收藏
========================================================= */

function toggleFavorite(id, event) {

    /*
    避免點愛心時同時打開詳細資料
    */

    if (event) {
        event.stopPropagation();
    }

    const asset = assets.find(
        item => String(item.id) === String(id)
    );

    if (!asset) return;

    asset.favorite = !asset.favorite;

    let favoriteIds = getFavoriteIds();

    if (asset.favorite) {

        if (!favoriteIds.includes(String(id))) {
            favoriteIds.push(String(id));
        }

    } else {

        favoriteIds =
            favoriteIds.filter(
                favoriteId =>
                    String(favoriteId) !== String(id)
            );

    }

    localStorage.setItem(
        "mindyFavoriteAssets",
        JSON.stringify(favoriteIds)
    );

    applyFilters();

}


/* =========================================================
   06. 套用搜尋與篩選
========================================================= */

function applyFilters() {

    filteredAssets = assets.filter(asset => {

        /*
        搜尋文字
        */

        const searchableText = [
            asset.title,
            asset.name,
            asset.type,
            asset.category,
            asset.project,
            asset.format,
            asset.file,
            asset.thumbnail,
            asset.note,
            ...(asset.tags || []),
            ...(asset.platform || [])
        ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();


        const matchSearch =
            !searchKeyword ||
            searchableText.includes(
                searchKeyword.toLowerCase()
            );


        /*
        素材類型
        */

        const matchType =
            currentType === "all" ||
            String(asset.type).toLowerCase() ===
            currentType.toLowerCase() ||
            String(asset.category).toLowerCase() ===
            currentType.toLowerCase();


        /*
        平台
        */

        const platforms =
            Array.isArray(asset.platform)
                ? asset.platform
                : asset.platform
                ? [asset.platform]
                : [];

        const matchPlatform =
            currentPlatform === "all" ||
            platforms.some(
                platform =>
                    String(platform).toLowerCase() ===
                    currentPlatform.toLowerCase()
            );


        /*
        尺寸
        */

        const matchSize =
            currentSize === "all" ||
            getAspectRatio(asset) === currentSize;


        /*
        專案
        */

        const matchProject =
            currentProject === "all" ||
            asset.project === currentProject;


        /*
        標籤
        */

        const matchTag =
            currentTag === "all" ||
            (asset.tags || []).includes(currentTag);


        return (
            matchSearch &&
            matchType &&
            matchPlatform &&
            matchSize &&
            matchProject &&
            matchTag
        );

    });


    sortAssets();

    renderAssets();

    renderDashboard();

    renderProjects();

    renderTags();

}


/* =========================================================
   07. 判斷圖片比例
========================================================= */

function getAspectRatio(asset) {

    const width = Number(asset.width);
    const height = Number(asset.height);

    if (!width || !height) {
        return "other";
    }

    const ratio = width / height;

    /*
    允許些微誤差
    */

    if (Math.abs(ratio - 1) < 0.08) {
        return "1:1";
    }

    if (Math.abs(ratio - 9 / 16) < 0.08) {
        return "9:16";
    }

    if (Math.abs(ratio - 16 / 9) < 0.08) {
        return "16:9";
    }

    return "other";

}


/* =========================================================
   08. 排序
========================================================= */

function sortAssets() {

    filteredAssets.sort((a, b) => {

        switch (currentSort) {

            case "oldest":

                return (
                    new Date(a.createdAt || 0) -
                    new Date(b.createdAt || 0)
                );


            case "name":

                return getAssetTitle(a).localeCompare(
                    getAssetTitle(b),
                    "zh-Hant"
                );


            case "favorite":

                return (
                    Number(b.favorite) -
                    Number(a.favorite)
                );


            case "newest":
            default:

                return (
                    new Date(b.createdAt || 0) -
                    new Date(a.createdAt || 0)
                );

        }

    });

}


/* =========================================================
   09. 取得素材名稱
========================================================= */

function getAssetTitle(asset) {

    return (
        asset.title ||
        asset.name ||
        "未命名素材"
    );

}


/* =========================================================
   10. 顯示素材卡片
========================================================= */

function renderAssets() {

    const container =
        document.querySelector("#assetGrid") ||
        document.querySelector(".asset-grid");

    if (!container) return;


    /*
    沒有搜尋結果
    */

    if (filteredAssets.length === 0) {

        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🔍</div>

                <h3>找不到符合條件的素材</h3>

                <p>
                    可以試著更換搜尋文字或篩選條件。
                </p>
            </div>
        `;

        updateAssetCount(0);

        return;

    }


    container.innerHTML =
        filteredAssets.map(asset => {

            const title = escapeHTML(
                getAssetTitle(asset)
            );

            const image =
                asset.thumbnail ||
                asset.file ||
                "";

            const tags =
                (asset.tags || [])
                .slice(0, 3)
                .map(
                    tag =>
                        `<span class="asset-tag">
                            #${escapeHTML(tag)}
                        </span>`
                )
                .join("");

            const size =
                asset.width && asset.height
                    ? `${asset.width} × ${asset.height}`
                    : "尺寸未設定";

            const favoriteIcon =
                asset.favorite ? "♥" : "♡";

            const favoriteClass =
                asset.favorite
                    ? "favorite active"
                    : "favorite";


            return `

                <article
                    class="asset-card"
                    data-id="${escapeHTML(asset.id)}"
                    role="button"
                    tabindex="0"
                    aria-label="查看素材：${title}"
                    onclick="openAssetDrawer('${escapeJS(asset.id)}')"
                    onkeydown="handleAssetCardKeydown(event, '${escapeJS(asset.id)}')"
                >

                    <div class="asset-preview">

                        ${
                            image

                            ? `
                                <img
                                    src="${escapeHTML(image)}"
                                    alt="${title}"
                                    loading="lazy"
                                    onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
                                >

                                <div
                                    class="preview-placeholder"
                                    style="display:none;"
                                >
                                    🖼️
                                </div>
                            `

                            : `
                                <div class="preview-placeholder">
                                    🖼️
                                </div>
                            `
                        }

                        <button
                            class="${favoriteClass}"
                            type="button"
                            title="收藏素材"
                            onclick="toggleFavorite('${escapeJS(asset.id)}', event)"
                        >
                            ${favoriteIcon}
                        </button>

                        <span class="asset-type-badge">
                            ${escapeHTML(
                                asset.category ||
                                asset.type ||
                                "素材"
                            )}
                        </span>

                    </div>


                    <div class="asset-card-body">

                        <h3 class="asset-title">
                            ${title}
                        </h3>

                        <div class="asset-meta">

                            <span>
                                ${escapeHTML(size)}
                            </span>

                            <span>
                                ${escapeHTML(
                                    asset.format || ""
                                )}
                            </span>

                        </div>

                        <div class="asset-tags">
                            ${tags}
                        </div>

                        <button
                            class="asset-detail-button"
                            type="button"
                            onclick="event.stopPropagation(); openAssetDrawer('${escapeJS(asset.id)}')"
                        >
                            查看詳細資料
                        </button>

                        ${
                            asset.project

                            ? `
                                <button
                                    class="asset-project"
                                    type="button"
                                    title="查看「${escapeHTML(asset.project)}」專案的素材"
                                    aria-label="查看 ${escapeHTML(asset.project)} 專案的素材"
                                    onclick="openAssetProject('${escapeJS(asset.project)}', event)"
                                >
                                    📁 ${escapeHTML(asset.project)}
                                </button>
                            `

                            : ""
                        }

                    </div>

                </article>

            `;

        }).join("");


    updateAssetCount(filteredAssets.length);

}


/*
素材卡片可用 Enter / Space 開啟詳細資料。
*/
function handleAssetCardKeydown(event, assetId) {

    if (event.target !== event.currentTarget) return;

    if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openAssetDrawer(assetId);
    }

}


/*
由素材卡片直接前往所屬專案，並阻止卡片同時開啟詳細側欄。
*/
function openAssetProject(project, event) {

    if (event) event.stopPropagation();

    selectProject(project);

    const libraryView = document.querySelector("#libraryView");
    if (libraryView) {
        libraryView.scrollIntoView({ behavior: "smooth", block: "start" });
    }

}


/* =========================================================
   11. 素材數量
========================================================= */

function updateAssetCount(count) {

    const elements =
        document.querySelectorAll(
            "[data-asset-count], #assetCount"
        );

    elements.forEach(element => {
        element.textContent = count;
    });

}


/* =========================================================
   12. Dashboard
========================================================= */

function renderDashboard() {

    setText(
        "totalAssets",
        assets.length
    );

    setText(
        "totalImages",
        assets.filter(
            asset =>
                String(asset.type).toLowerCase() === "image"
        ).length
    );

    setText(
        "totalVideos",
        assets.filter(
            asset =>
                String(asset.type).toLowerCase() === "video"
        ).length
    );

    setText(
        "totalFavorites",
        assets.filter(
            asset => asset.favorite
        ).length
    );


    /*
    最近新增素材
    */

    const recentContainer =
        document.querySelector("#recentAssets");

    if (recentContainer) {

        const recentAssets =
            [...assets]
            .sort(
                (a, b) =>
                    new Date(b.createdAt || 0) -
                    new Date(a.createdAt || 0)
            )
            .slice(0, 6);

        recentContainer.innerHTML =
            recentAssets.map(asset => {

                const image =
                    asset.thumbnail ||
                    asset.file ||
                    "";

                return `

                    <div
                        class="recent-asset"
                        onclick="openAssetDrawer('${escapeJS(asset.id)}')"
                    >

                        ${
                            image

                            ? `
                                <img
                                    src="${escapeHTML(image)}"
                                    alt="${escapeHTML(
                                        getAssetTitle(asset)
                                    )}"
                                >
                            `

                            : `
                                <div class="recent-placeholder">
                                    🖼️
                                </div>
                            `
                        }

                        <span>
                            ${escapeHTML(
                                getAssetTitle(asset)
                            )}
                        </span>

                    </div>

                `;

            }).join("");

    }

}


/* =========================================================
   13. 專案統計
========================================================= */

function renderProjects() {

    const container =
        document.querySelector("#projectList");

    if (!container) return;


    const projectMap = {};

    assets.forEach(asset => {

        if (!asset.project) return;

        if (!projectMap[asset.project]) {
            projectMap[asset.project] = 0;
        }

        projectMap[asset.project]++;

    });


    const projects =
        Object.entries(projectMap)
        .sort((a, b) => b[1] - a[1]);


    container.innerHTML = `

        <button
            class="project-item ${
                currentProject === "all"
                    ? "active"
                    : ""
            }"
            onclick="selectProject('all')"
        >
            <span>📂 全部專案</span>
            <strong>${assets.length}</strong>
        </button>

        ${projects.map(([project, count]) => `

            <button
                class="project-item ${
                    currentProject === project
                        ? "active"
                        : ""
                }"
                onclick="selectProject('${escapeJS(project)}')"
            >
                <span>
                    📁 ${escapeHTML(project)}
                </span>

                <strong>
                    ${count}
                </strong>
            </button>

        `).join("")}

    `;

}


/* =========================================================
   14. 選擇專案
========================================================= */

function selectProject(project) {

    currentProject = project;
    currentTag = "all";
    currentType = "all";
    currentPlatform = "all";
    currentSize = "all";
    searchKeyword = "";

    const searchInput = document.querySelector("#globalSearch");
    if (searchInput) searchInput.value = "";

    showCurrentView("libraryView");

    const title = document.querySelector("#libraryTitle");
    const subtitle = document.querySelector("#librarySubtitle");

    if (title) {
        title.textContent = project === "all" ? "全部素材" : project;
    }

    if (subtitle) {
        subtitle.textContent = project === "all"
            ? "集中瀏覽、篩選與管理你的所有素材。"
            : `瀏覽「${project}」專案中已儲存的素材。`;
    }

    applyFilters();

}


function showCurrentView(viewId) {

    document.querySelectorAll(".view").forEach(view => {
        view.classList.remove("active-view");
    });

    const target = document.getElementById(viewId);
    if (target) target.classList.add("active-view");

}


/* =========================================================
   15. 標籤
========================================================= */

function renderTags() {

    const container =
        document.querySelector("#tagList");

    if (!container) return;


    const tagMap = {};

    assets.forEach(asset => {

        (asset.tags || []).forEach(tag => {

            if (!tagMap[tag]) {
                tagMap[tag] = 0;
            }

            tagMap[tag]++;

        });

    });


    const tags =
        Object.entries(tagMap)
        .sort((a, b) => b[1] - a[1]);


    container.innerHTML = `

        <button
            class="tag-filter ${
                currentTag === "all"
                    ? "active"
                    : ""
            }"
            onclick="selectTag('all')"
        >
            全部
        </button>

        ${tags.map(([tag, count]) => `

            <button
                class="tag-filter ${
                    currentTag === tag
                        ? "active"
                        : ""
                }"
                onclick="selectTag('${escapeJS(tag)}')"
            >
                #${escapeHTML(tag)}
                <span>${count}</span>
            </button>

        `).join("")}

    `;

}


/* =========================================================
   16. 選擇標籤
========================================================= */

function selectTag(tag) {

    currentTag = tag;

    applyFilters();

}


/* =========================================================
   17. 搜尋
========================================================= */

function setupSearch() {

    const searchInputs =
        document.querySelectorAll(
            "#globalSearch, #searchInput, [data-search-input]"
        );

    searchInputs.forEach(input => {

        input.addEventListener("input", event => {

            searchKeyword =
                event.target.value.trim();

            if (searchKeyword) {
                const keyword = searchKeyword.toLowerCase();

                const matchingAsset = assets.find(asset => {
                    const values = [
                        asset.project,
                        asset.title,
                        asset.name,
                        asset.file,
                        asset.thumbnail
                    ];

                    return values
                        .filter(Boolean)
                        .some(value =>
                            String(value).toLowerCase().includes(keyword)
                        );
                });

                currentProject = matchingAsset?.project || "all";
                currentType = "all";
                currentPlatform = "all";
                currentSize = "all";

                showCurrentView("libraryView");

                const title = document.querySelector("#libraryTitle");
                const subtitle = document.querySelector("#librarySubtitle");

                if (title) {
                    title.textContent = matchingAsset?.project
                        ? matchingAsset.project
                        : `搜尋：${searchKeyword}`;
                }

                if (subtitle) {
                    subtitle.textContent = matchingAsset?.project
                        ? `顯示「${matchingAsset.project}」專案中符合「${searchKeyword}」的素材。`
                        : `顯示符合「${searchKeyword}」的全部素材。`;
                }
            }

            applyFilters();

        });

    });

}


/* =========================================================
   18. 篩選按鈕
========================================================= */

function setupFilters() {

    /*
    類型
    */

    document
        .querySelectorAll("[data-type]")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    currentType =
                        button.dataset.type;

                    setActiveButton(
                        "[data-type]",
                        button
                    );

                    applyFilters();

                }
            );

        });


    /*
    平台
    */

    document
        .querySelectorAll("[data-platform]")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    currentPlatform =
                        button.dataset.platform;

                    setActiveButton(
                        "[data-platform]",
                        button
                    );

                    applyFilters();

                }
            );

        });


    /*
    尺寸
    */

    document
        .querySelectorAll("[data-size]")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    currentSize =
                        button.dataset.size;

                    setActiveButton(
                        "[data-size]",
                        button
                    );

                    applyFilters();

                }
            );

        });

}


/* =========================================================
   19. 設定篩選按鈕 active
========================================================= */

function setActiveButton(selector, activeButton) {

    document
        .querySelectorAll(selector)
        .forEach(button => {
            button.classList.remove("active");
        });

    activeButton.classList.add("active");

}


/* =========================================================
   20. 排序選單
========================================================= */

function setupSort() {

    const sortSelect =
        document.querySelector("#sortSelect");

    if (!sortSelect) return;


    sortSelect.addEventListener(
        "change",
        event => {

            currentSort =
                event.target.value;

            applyFilters();

        }
    );

}


/* =========================================================
   21. 打開素材詳細側欄
========================================================= */

function openAssetDrawer(id) {

    const asset = assets.find(
        item =>
            String(item.id) === String(id)
    );

    if (!asset) return;


    const drawer =
        document.querySelector("#assetDrawer");

    const overlay =
        document.querySelector("#drawerOverlay");


    if (!drawer) return;


    const fileLooksLikeImage =
        /\.(avif|gif|jpe?g|png|svg|webp)(?:[?#].*)?$/i.test(
            String(asset.file || "")
        );

    const image =
        asset.thumbnail ||
        (fileLooksLikeImage ? asset.file : "") ||
        "";


    const platforms =
        Array.isArray(asset.platform)
            ? asset.platform
            : asset.platform
            ? [asset.platform]
            : [];


    const tags =
        (asset.tags || [])
        .map(
            tag =>
                `<span class="drawer-tag">
                    #${escapeHTML(tag)}
                </span>`
        )
        .join("");


    const preview =
        drawer.querySelector(
            "[data-drawer-preview]"
        );

    if (preview) {

        preview.innerHTML =
            image

            ? `
                <img
                    src="${escapeHTML(image)}"
                    alt="${escapeHTML(
                        getAssetTitle(asset)
                    )}"
                >
            `

            : `
                <div class="drawer-placeholder">
                    🖼️
                </div>
            `;

    }


    setDrawerText(
        drawer,
        "title",
        getAssetTitle(asset)
    );

    setDrawerText(
        drawer,
        "type",
        asset.category ||
        asset.type ||
        "-"
    );

    setDrawerText(
        drawer,
        "project",
        asset.project || "-"
    );

    setDrawerText(
        drawer,
        "size",
        asset.width && asset.height
            ? `${asset.width} × ${asset.height}`
            : "-"
    );

    setDrawerText(
        drawer,
        "format",
        asset.format || "-"
    );

    setDrawerText(
        drawer,
        "created",
        asset.createdAt || "-"
    );

    setDrawerText(
        drawer,
        "platform",
        platforms.join("、") || "-"
    );

    setDrawerText(
        drawer,
        "file",
        asset.file || "尚未設定"
    );

    setDrawerText(
        drawer,
        "note",
        asset.note || "尚未設定備註"
    );


    const tagContainer =
        drawer.querySelector(
            "[data-drawer-tags]"
        );

    if (tagContainer) {
        tagContainer.innerHTML =
            tags || "尚未設定標籤";
    }


    /*
    收藏按鈕
    */

    const favoriteButton =
        drawer.querySelector(
            "[data-drawer-favorite]"
        );

    if (favoriteButton) {

        favoriteButton.textContent =
            asset.favorite
                ? "♥ 已收藏"
                : "♡ 收藏";

        favoriteButton.onclick = () => {

            toggleFavorite(asset.id);

            openAssetDrawer(asset.id);

        };

    }


    /*
    下載按鈕
    */

    const downloadButton =
        drawer.querySelector(
            "[data-drawer-download]"
        );

    if (downloadButton) {

        const fileCanDownload =
            asset.file &&
            /\.[a-zA-Z0-9]{1,8}(?:[?#].*)?$/.test(asset.file);

        if (fileCanDownload) {

            downloadButton.style.display = "";

            downloadButton.onclick = () => {
                downloadAsset(asset);
            };

        } else {

            downloadButton.style.display = "none";

        }

    }


    /*
    複製路徑
    */

    const copyButton =
        drawer.querySelector(
            "[data-drawer-copy]"
        );

    if (copyButton) {

        copyButton.onclick = async () => {

            if (!asset.file) return;

            try {

                await navigator.clipboard.writeText(
                    asset.file
                );

                const original =
                    copyButton.textContent;

                copyButton.textContent =
                    "✓ 已複製";

                setTimeout(() => {
                    copyButton.textContent =
                        original;
                }, 1500);

            }

            catch {

                alert(
                    "無法自動複製，素材路徑為：\n" +
                    asset.file
                );

            }

        };

    }


    /*
    開啟本機檔案／資料夾位置或網路網址
    */
    const openLocationButton =
        drawer.querySelector(
            "[data-drawer-open-location]"
        );

    if (openLocationButton) {

        openLocationButton.style.display =
            asset.file ? "" : "none";

        openLocationButton.onclick = () => {
            if (!asset.file) return;
            openAssetLocation(asset.file);
        };

    }


    drawer.classList.add("open");
    drawer.setAttribute("aria-hidden", "false");

    if (overlay) {
        overlay.classList.add("show");
    }

    document.body.classList.add(
        "drawer-open"
    );

}


/*
Windows 本機路徑轉換為瀏覽器可辨識的 file URL。
瀏覽器若因安全政策阻擋，會顯示可複製的原始路徑。
*/
function openAssetLocation(path) {

    const originalPath = String(path || "").trim();
    if (!originalPath) return;

    let target = originalPath;

    if (/^[a-zA-Z]:[\\/]/.test(originalPath)) {
        target = "file:///" + originalPath
            .replace(/\\/g, "/")
            .split("/")
            .map((part, index) => index === 0 ? part : encodeURIComponent(part))
            .join("/");
    }

    const opened = window.open(target, "_blank");

    if (opened) opened.opener = null;

    if (!opened) {
        alert(
            "瀏覽器基於安全限制，無法直接開啟本機位置。請複製後貼到檔案總管：\n" +
            originalPath
        );
    }

}


/* =========================================================
   22. 設定側欄文字
========================================================= */

function setDrawerText(
    drawer,
    key,
    value
) {

    const element =
        drawer.querySelector(
            `[data-drawer-${key}]`
        );

    if (element) {
        element.textContent = value;
    }

}


/* =========================================================
   23. 關閉素材詳細側欄
========================================================= */

function closeAssetDrawer() {

    const drawer =
        document.querySelector("#assetDrawer");

    const overlay =
        document.querySelector("#drawerOverlay");

    if (drawer) {
        drawer.classList.remove("open");
        drawer.setAttribute("aria-hidden", "true");
    }

    if (overlay) {
        overlay.classList.remove("show");
    }

    document.body.classList.remove(
        "drawer-open"
    );

}


/* =========================================================
   24. 設定側欄事件
========================================================= */

function setupDrawer() {

    document
        .querySelectorAll(
            "[data-close-drawer]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                closeAssetDrawer
            );

        });


    const overlay =
        document.querySelector(
            "#drawerOverlay"
        );

    if (overlay) {

        overlay.addEventListener(
            "click",
            closeAssetDrawer
        );

    }


    document.addEventListener(
        "keydown",
        event => {

            if (event.key === "Escape") {

                closeAssetDrawer();

                closeAddAssetModal();

            }

        }
    );

}


/* =========================================================
   25. 下載素材
========================================================= */

function downloadAsset(asset) {

    if (!asset.file) return;

    const link =
        document.createElement("a");

    link.href = asset.file;

    link.download =
        getAssetTitle(asset);

    link.target = "_blank";

    document.body.appendChild(link);

    link.click();

    link.remove();

}


/* =========================================================
   26. 新增素材 Modal
========================================================= */

function setupModal() {

    document.addEventListener("click", event => {
        const openButton = event.target.closest(
            "[data-open-add-modal], #addAssetButton"
        );

        if (openButton) {
            event.preventDefault();
            openAddAssetModal();
            return;
        }

        const closeButton = event.target.closest(
            "[data-close-add-modal]"
        );

        if (closeButton) {
            event.preventDefault();
            event.stopPropagation();
            closeAddAssetModal();
        }
    }, true);

}


/* =========================================================
   27. 打開新增素材
========================================================= */

function openAddAssetModal() {

    const modal =
        document.querySelector(
            "#addAssetModal"
        );

    if (!modal) {
        console.error(
            "找不到 #addAssetModal"
        );

        return;
    }

    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");

    document.body.classList.add(
        "modal-open"
    );

}


/* =========================================================
   28. 關閉新增素材
========================================================= */

function closeAddAssetModal() {

    const modal =
        document.querySelector("#addAssetModal");

    if (!modal) {
        console.error("找不到 #addAssetModal");
        return;
    }

    modal.classList.remove("show");
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");

    document.body.classList.remove("modal-open");

}


/* =========================================================
   29. 新增素材表單
========================================================= */

function setupAddAssetForm() {

    const form =
        document.querySelector(
            "#addAssetForm, #assetForm"
        );

    if (!form) return;


    form.addEventListener(
        "submit",
        event => {

            event.preventDefault();


            const formData =
                new FormData(form);


            const title =
                String(
                    formData.get("title") || ""
                ).trim();


            if (!title) {

                alert("請輸入素材名稱");

                return;

            }


            /*
            tags 使用逗號分隔
            */

            const tags =
                String(
                    formData.get("tags") || ""
                )
                .split(/[,，]/)
                .map(tag => tag.trim())
                .filter(Boolean);


            /*
            platform 可以是多選 checkbox
            */

            const platforms =
                formData.getAll("platform");


            const newAsset = {

                id:
                    "asset_" +
                    Date.now(),

                title: title,

                type:
                    formData.get("type") ||
                    "image",

                category:
                    formData.get("category") ||
                    "",

                project:
                    String(
                        formData.get("project") || ""
                    ).trim(),

                platform:
                    platforms,

                tags: tags,

                width:
                    Number(
                        formData.get("width")
                    ) || null,

                height:
                    Number(
                        formData.get("height")
                    ) || null,

                format:
                    String(
                        formData.get("format") || ""
                    ).toUpperCase(),

                file:
                    String(
                        formData.get("file") || ""
                    ).trim(),

                thumbnail:
                    String(
                        formData.get("thumbnail") || ""
                    ).trim(),

                favorite: false,

                status:
                    formData.get("status") ||
                    "draft",

                createdAt:
                    new Date()
                    .toISOString()
                    .slice(0, 10),

                note:
                    String(
                        formData.get("note") || ""
                    ).trim()

            };


            /*
            新增到最前面
            */

            assets.unshift(newAsset);


            /*
            存到 localStorage
            */

            const localAssets =
                JSON.parse(
                    localStorage.getItem(
                        "mindyCustomAssets"
                    )
                ) || [];

            localAssets.unshift(newAsset);

            localStorage.setItem(
                "mindyCustomAssets",
                JSON.stringify(localAssets)
            );


            /*
            清空表單
            */

            form.reset();


            closeAddAssetModal();

            applyFilters();


            alert("素材新增完成！");

        }
    );

}


/* =========================================================
   30. 頁面導覽
========================================================= */

function setupNavigation() {

    document
        .querySelectorAll("[data-view-jump='all']")
        .forEach(button => {

            button.addEventListener("click", () => {
                selectProject("all");

                document.querySelectorAll(".nav-item").forEach(item => {
                    item.classList.remove("active");
                });

                const allAssetsButton = document.querySelector(
                    ".nav-item[data-view='all']"
                );

                if (allAssetsButton) {
                    allAssetsButton.classList.add("active");
                }
            });

        });

    document
        .querySelectorAll(".nav-item[data-view]")
        .forEach(button => {

            button.addEventListener("click", () => {

                const view = button.dataset.view;

                document.querySelectorAll(".nav-item").forEach(item => {
                    item.classList.remove("active");
                });
                button.classList.add("active");

                if (view === "dashboard") {
                    showCurrentView("dashboardView");
                    currentProject = "all";
                    applyFilters();
                    return;
                }

                if (view === "projects") {
                    showCurrentView("projectsView");
                    return;
                }

                if (view === "tags") {
                    showCurrentView("tagsView");
                    return;
                }

                selectProject("all");
            });

        });

    document
        .querySelectorAll(".nav-item[data-type-filter]")
        .forEach(button => {

            button.addEventListener("click", () => {
                currentProject = "all";
                currentType = button.dataset.typeFilter;
                showCurrentView("libraryView");
                applyFilters();
            });

        });

    document
        .querySelectorAll("[data-page]")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    const page =
                        button.dataset.page;

                    showPage(page);

                    document
                        .querySelectorAll(
                            "[data-page]"
                        )
                        .forEach(item => {
                            item.classList.remove(
                                "active"
                            );
                        });

                    button.classList.add(
                        "active"
                    );

                }
            );

        });

}


/* =========================================================
   31. 切換頁面
========================================================= */

function showPage(pageName) {

    document
        .querySelectorAll(
            "[data-page-section]"
        )
        .forEach(section => {

            section.classList.remove(
                "active"
            );

        });


    const target =
        document.querySelector(
            `[data-page-section="${pageName}"]`
        );


    if (target) {

        target.classList.add(
            "active"
        );

    }


    /*
    收藏頁
    */

    if (pageName === "favorites") {

        currentProject = "all";
        currentTag = "all";

        filteredAssets =
            assets.filter(
                asset => asset.favorite
            );

        sortAssets();

        renderAssets();

    }


    /*
    最近新增
    */

    else if (pageName === "recent") {

        filteredAssets =
            [...assets]
            .sort(
                (a, b) =>
                    new Date(b.createdAt || 0) -
                    new Date(a.createdAt || 0)
            )
            .slice(0, 30);

        renderAssets();

    }


    /*
    全部素材
    */

    else if (pageName === "assets") {

        currentProject = "all";
        currentTag = "all";

        applyFilters();

    }

}


/* =========================================================
   32. 設定文字
========================================================= */

function setText(id, value) {

    const element =
        document.getElementById(id);

    if (element) {
        element.textContent = value;
    }

}


/* =========================================================
   33. HTML 安全處理
========================================================= */

function escapeHTML(value) {

    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

}


/* =========================================================
   34. JavaScript 字串安全處理
========================================================= */

function escapeJS(value) {

    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }

    return String(value)
        .replace(/\\/g, "\\\\")
        .replace(/'/g, "\\'");

}


/* =========================================================
   35. 手機版側邊選單
========================================================= */

function toggleSidebar() {

    const sidebar =
        document.querySelector(
            ".sidebar"
        );

    const overlay =
        document.querySelector(
            ".sidebar-overlay"
        );

    if (sidebar) {

        sidebar.classList.toggle(
            "mobile-open"
        );

    }

    if (overlay) {

        overlay.classList.toggle(
            "show"
        );

    }

}


/* =========================================================
   36. 清除所有篩選
========================================================= */

function clearFilters() {

    currentType = "all";
    currentPlatform = "all";
    currentSize = "all";
    currentProject = "all";
    currentTag = "all";
    searchKeyword = "";


    /*
    清空搜尋框
    */

    document
        .querySelectorAll(
            "#searchInput, [data-search-input]"
        )
        .forEach(input => {
            input.value = "";
        });


    /*
    重設篩選按鈕
    */

    resetFilterButtons(
        "[data-type]",
        "all",
        "type"
    );

    resetFilterButtons(
        "[data-platform]",
        "all",
        "platform"
    );

    resetFilterButtons(
        "[data-size]",
        "all",
        "size"
    );


    applyFilters();

}


/* =========================================================
   37. 重設篩選按鈕
========================================================= */

function resetFilterButtons(
    selector,
    value,
    datasetName
) {

    document
        .querySelectorAll(selector)
        .forEach(button => {

            button.classList.remove(
                "active"
            );

            if (
                button.dataset[
                    datasetName
                ] === value
            ) {

                button.classList.add(
                    "active"
                );

            }

        });

}


/* =========================================================
   38. 將常用函式掛到 window

   因為部分 HTML 使用 onclick=""
   必須讓函式能被全域呼叫。
========================================================= */

window.toggleFavorite =
    toggleFavorite;

window.openAssetDrawer =
    openAssetDrawer;

window.handleAssetCardKeydown =
    handleAssetCardKeydown;

window.openAssetProject =
    openAssetProject;

window.closeAssetDrawer =
    closeAssetDrawer;

window.selectProject =
    selectProject;

window.selectTag =
    selectTag;

window.toggleSidebar =
    toggleSidebar;

window.clearFilters =
    clearFilters;

window.openAddAssetModal =
    openAddAssetModal;

window.closeAddAssetModal =
    closeAddAssetModal;


/* =========================================================
   Mindy Asset Hub
   app.js END
========================================================= */
