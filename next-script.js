// 필요한 어댑터가 로드되어 있어야 함:
{/* <script src="https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns"></script>;
<script src="https://cdn.jsdelivr.net/npm/chartjs-chart-financial"></script> */}


window.addEventListener('DOMContentLoaded', async () => {
  try {
    const res = await fetch('http://localhost:4001/stock/prediction');
    if (!res.ok) throw new Error('Prediction API 오류');
    const data = await res.json();

    renderTopStockList(data.topStockList);                      // 1) 상위 종목 리스트
    renderPrediction(data.preRate.previousList);                // 3) 예측 위젯
    setupChartButtons(data.stockChart, data.preRate.previousList); // ✅ 수정된 차트 버튼
    setupStockClickEvent();                                     // 4) 종목 클릭 이벤트

  } catch (err) {
    console.error(err);
    alert('데이터 로딩 중 오류가 발생했습니다.');
  }
});


// 1) 상위 종목 리스트
function renderTopStockList(list) {
  const tbody = document.querySelector('.stock-table tbody');
  tbody.innerHTML = '';
  list.forEach(item => {
    console.log("렌더링 항목:", item);  // 디버깅용
    const tr = document.createElement('tr');
    tr.classList.add("stock-item");

    // 정확한 코드명 사용
    tr.dataset.shortcode = item.shortcode;  // 백엔드 응답에 맞게

    tr.innerHTML = `
      <td>${item.stocks}</td>
      <td>${item.price.toLocaleString()}₩</td>
    `;
    tbody.appendChild(tr);
  });
}


// 2) 차트 버튼
let currentCombinedChart = null;

function setupChartButtons(stockChart, predictionList) {
  const ctx = document.getElementById("combinedChart").getContext("2d");

  document.querySelectorAll('.filter button').forEach(btn => {
    btn.addEventListener('click', () => {
      const txt = btn.innerText;
      let selectedChartData;
      let label;

      if (txt.includes('15')) {
        selectedChartData = stockChart.weekChart;
        label = '15일';
      } else if (txt.includes('한달')) {
        selectedChartData = stockChart.monthChart;
        label = '1달';
      } else if (txt.includes('일년')) {
        selectedChartData = stockChart.yearChart;
        label = '1년';
      }

      const candleData = selectedChartData.stockCharts.map(c => ({
        x: new Date(c.date),
        o: c.openingPrice,
        h: c.highestPrice,
        l: c.lowestPrice,
        c: c.closingPrice
      }));

      const predictionData = predictionList.map(p => ({
        x: new Date(p.previousDate),
        y: p.previousPrice
      }));

      const lastActualDate = candleData[candleData.length - 1]?.x;

      drawCombinedChart(ctx, candleData, predictionData, lastActualDate, label);
    });
  });

  // 최초 로드 시 15일 데이터로 표시
  const initCandle = stockChart.weekChart.stockCharts.map(c => ({
    x: new Date(c.date),
    o: c.openingPrice,
    h: c.highestPrice,
    l: c.lowestPrice,
    c: c.closingPrice
  }));
  const initPrediction = predictionList.map(p => ({
    x: new Date(p.previousDate),
    y: p.previousPrice
  }));
  const lastActual = initCandle[initCandle.length - 1]?.x;

  drawCombinedChart(ctx, initCandle, initPrediction, lastActual, '15일');
}

function drawCombinedChart(ctx, candleData, predictionData, lastActualDate, label) {
  if (currentCombinedChart) {
    currentCombinedChart.destroy();
  }

  currentCombinedChart = new Chart(ctx, {
    type: 'candlestick',
    data: {
      datasets: [
        {
          type: 'candlestick',
          label: `${label} 실데이터`,
          data: candleData,
          borderColor: '#0066ff',
        },
        {
          type: 'line',
          label: '예측 추이',
          data: predictionData,
          borderColor: 'lime',
          borderWidth: 2,
          pointRadius: 1,
          fill: false,
          tension: 0.3
        },
        {
          type: 'line',
          label: '기준선',
          data: [
            { x: lastActualDate, y: 0 },
            { x: lastActualDate, y: Math.max(...candleData.map(a => a.h)) * 1.1 }
          ],
          borderColor: 'gray',
          borderWidth: 1,
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: true }
      },
      scales: {
        x: {
          type: 'time',
          time: { unit: label === '1년' ? 'month' : 'day' },
          title: { display: true, text: '날짜' }
        },
        y: {
          title: { display: true, text: '가격 (원)' }
        }
      }
    }
  });
}



// 3) 예측 변동률 및 선형 예측 차트
function renderPrediction(prevList) {
  const recent = prevList[prevList.length - 1];
  const percentElem = document.querySelector('.percent-widget .percent');
  percentElem.innerText = (recent.previousPercentage >= 0 ? '+' : '') +
                          recent.previousPercentage.toFixed(2) + '%';
  percentElem.classList.toggle('up', recent.previousPercentage >= 0);
  percentElem.classList.toggle('down', recent.previousPercentage < 0);

  const ctx2 = document.getElementById('linePrediction').getContext('2d');
  const dates = prevList.map(p => new Date(p.previousDate));
  const prices = prevList.map(p => p.previousPrice);

  new Chart(ctx2, {
    type: 'line',
    data: {
      labels: dates,
      datasets: [{
        label: '예상 가격 추이',
        data: prices,
        borderColor: recent.previousPercentage >= 0 ? 'lime' : 'red',
        fill: false,
        tension: 0.2
      }]
    },
    options: {
      scales: {
        x: {
          type: 'time',
          time: { unit: 'day' },
          title: { display: true, text: '날짜' }
        },
        y: {
          beginAtZero: false,
          title: { display: true, text: '예상 가격 (원)' }
        }
      }
    }
  });
}

// 4) 종목 클릭 시 개별 차트 렌더링
function setupStockClickEvent() {
  document.querySelectorAll(".stock-item").forEach(item => {
    item.addEventListener("click", function () {
      const shortCode = this.dataset.shortcode;
      const stockName = this.querySelector('td').innerText;
      console.log("shortCode 전달됨:", shortCode);
      
      document.getElementById('selectedStockName').innerText = stockName;

      document.getElementById('stockChart').style.display = 'none';
      document.getElementById('candleChart').style.display = 'block';


      fetch(`http://localhost:4001/stock/prediction?shortCodeParam=${shortCode}`)
        .then(response => response.json())
        .then(data => {
          if (data.code === "SU" && data.stockChart && data.stockChart.weekChart && Array.isArray(data.stockChart.weekChart.stockCharts)) {
            const candleData = data.stockChart.weekChart.stockCharts.map(item => ({
              x: new Date(item.date),
              o: item.openingPrice,
              h: item.highestPrice,
              l: item.lowestPrice,
              c: item.closingPrice
            }));

            drawCandleChart(candleData);
          } else {
            alert("차트 데이터를 불러올 수 없습니다.");
          }
        })
        .catch(error => {
          console.error("차트 데이터 요청 실패:", error);
          alert("서버 연결에 실패했습니다.");
        });
    });
  });
}



// 개별 종목 캔들차트 렌더링
function drawCandleChart(candleData) {
  const ctx = document.getElementById("candleChart").getContext("2d");

  if (window.candleChartInstance) {
    window.candleChartInstance.destroy();
  }

  window.candleChartInstance = new Chart(ctx, {
    type: 'candlestick',
    data: {
      datasets: [{
        label: '예측 주가',
        data: candleData,
        borderColor: 'rgb(0, 102, 255)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: true }
      },
      scales: {
        x: {
          type: 'time',
          time: { unit: 'day', tooltipFormat: 'yyyy-MM-dd' },
          title: { display: true, text: '날짜' }
        },
        y: {
          title: { display: true, text: '가격 (원)' }
        }
      }
    }
  });
}