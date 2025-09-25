// 가격 변동에 따른 색상 및 텍스트 업데이트 함수
function updateChangeColor(element, value) {
  const floatValue = parseFloat(value);
  if (floatValue > 0) {
    element.textContent = `+${floatValue.toFixed(2)}`;
    element.classList.add('up');
    element.classList.remove('down');
  } else if (floatValue < 0) {
    element.textContent = floatValue.toFixed(2);
    element.classList.add('down');
    element.classList.remove('up');
  } else {
    element.textContent = floatValue.toFixed(2);
    element.classList.remove('up', 'down');
  }
}

// 코스피, 환율, 유가 가격 + 변동값 업데이트 함수
function updateKospi(kospi) {
  const priceElement = document.getElementById("kospi-price");
  priceElement.innerHTML = `${kospi.price.toLocaleString()} <span class="change"></span>`;
  const changeSpan = priceElement.querySelector('.change');
  updateChangeColor(changeSpan, kospi.indecrease);
}

function updateExchange(exchange) {
  const priceElement = document.getElementById("exchange-price");
  priceElement.innerHTML = `${exchange.price.toLocaleString()} <span class="change"></span>`;
  const changeSpan = priceElement.querySelector('.change');
  updateChangeColor(changeSpan, exchange.indecrease);
}

function updateOil(oil) {
  const priceElement = document.getElementById("oil-price");
  priceElement.innerHTML = `${oil.price.toLocaleString()} <span class="change"></span>`;
  const changeSpan = priceElement.querySelector('.change');
  updateChangeColor(changeSpan, oil.indecrease);
}

// 거래량 테이블 업데이트 함수
function updateVolume(volumeData) {
  const volumeBody = document.getElementById("volume-body");
  volumeBody.innerHTML = ""; // 초기화

  volumeData.forEach((item) => {
    const row = document.createElement("tr");

    const tdName = document.createElement("td");
    tdName.textContent = item.stocks;

    const tdVolume = document.createElement("td");
    tdVolume.textContent = item.volume.toLocaleString();

    const tdChange = document.createElement("td");
    tdChange.textContent = `${item.volumeIndecrease >= 0 ? "+" : ""}${item.volumeIndecrease.toLocaleString()}`;
    tdChange.className = item.volumeIndecrease >= 0 ? "up" : "down";

    const tdPercent = document.createElement("td");
    tdPercent.textContent = `${item.volumePercentage >= 0 ? "+" : ""}${item.volumePercentage.toFixed(2)}%`;
    tdPercent.className = item.volumePercentage >= 0 ? "up" : "down";

    row.appendChild(tdName);
    row.appendChild(tdVolume);
    row.appendChild(tdChange);
    row.appendChild(tdPercent);

    volumeBody.appendChild(row);
  });
}

// 그래프 그리기
async function loadChartDataFromResponse(widgetId, dataPath, priceKey) {
  try {
    const res = await fetch(dataPath);
    const json = await res.json();

    let pricesRaw = [];

    if (dataPath.includes("kospi")) {
      pricesRaw = json.kospiIndex.kospiChat;
    } else if (dataPath.includes("exchange")) {
      pricesRaw = json.exchangeRate.exchangeChat;
    } else if (dataPath.includes("oil")) {
      // 유가는 oilTypes 배열 중 첫 번째(휘발유) 기준으로 하겠습니다.
      pricesRaw = json.oilPrice.oilTypes[0].oilChat;
    }

    // 가격 배열만 추출 (가격 0 이하 제외)
    const prices = pricesRaw
      .map(item => item[priceKey])
      .filter(price => price > 0);

    if (prices.length === 0) return;

    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;

    const widget = document.getElementById(widgetId);
    if (!widget) return;

    const chartContainer = widget.querySelector('.chart-container');
    if (!chartContainer) return;

    chartContainer.innerHTML = ""; // 기존 그래프 제거

    const canvas = document.createElement('canvas');
    canvas.width = 140;
    canvas.height = 40;
    canvas.style.marginTop = '10px';
    const ctx = canvas.getContext('2d');

    ctx.beginPath();
    ctx.moveTo(0, 40 - ((prices[0] - min) / range) * 40);

    prices.forEach((price, i) => {
      const x = (i / (prices.length - 1)) * canvas.width;
      const y = 40 - ((price - min) / range) * 40;
      ctx.lineTo(x, y);
    });

    const color = prices[prices.length - 1] >= prices[0] ? '#10b981' : '#ef4444';
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();

    chartContainer.appendChild(canvas);
  } catch (e) {
    console.error('그래프 데이터 로딩 오류:', e);
  }
}

// 시간 알림 업데이트 함수
function padZero(num) {
  return num < 10 ? '0' + num : num;
}

function updateTimeNotification() {
  const now = new Date();

  const year = now.getFullYear();
  const month = padZero(now.getMonth() + 1);
  const date = padZero(now.getDate());
  const hours = padZero(now.getHours());
  const minutes = padZero(now.getMinutes());
  const seconds = padZero(now.getSeconds());

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yYear = yesterday.getFullYear();
  const yMonth = padZero(yesterday.getMonth() + 1);
  const yDate = padZero(yesterday.getDate());

  const timeNotification = document.getElementById('timeNotification');
  if (!timeNotification) return;

  timeNotification.innerHTML =
    `현재 시간: ${year}-${month}-${date} ${hours}:${minutes}:${seconds} <br>
    모든 데이터는 어제 날짜인 <strong>${yYear}-${yMonth}-${yDate}</strong> 기준입니다.`;
}

// 페이지 로드 완료 후 초기화 및 데이터 호출
document.addEventListener("DOMContentLoaded", () => {
  // 시간 알림
  updateTimeNotification();
  setInterval(updateTimeNotification, 1000);

  // 초기 그래프 로딩
  loadChartDataFromResponse('kospi-widget', 'data/kospi.json', 'kchat');
  loadChartDataFromResponse('exchange-widget', 'data/exchange.json', 'echat');
  loadChartDataFromResponse('oil-widget', 'data/oil.json', 'ochat'); // 실제 키 확인 필요

  // 백엔드 API 호출
  fetch("/api/stock/main")
    .then((response) => response.json())
    .then((data) => {
      if (data.code === "SU") {
        updateKospi(data.kospiIndex.kospiPreviousClose);
        updateExchange(data.exchangeRate.exchangePreviousClose);
        updateOil(data.oilPrice.oilTypes[0].oilPreviousClose); // 휘발유 기준
        updateVolume(data.tradingVolume);
      } else {
        console.error("서버에서 데이터를 가져오지 못했습니다.");
      }
    })
    .catch((error) => {
      console.error("데이터 요청 중 오류 발생:", error);
    });
});



