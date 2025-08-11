package ru.slivkiai.flowdetect.service;

import lombok.RequiredArgsConstructor;
import org.jfree.chart.ChartFactory;
import org.jfree.chart.ChartUtils;
import org.jfree.chart.JFreeChart;
import org.jfree.data.time.Hour;
import org.jfree.data.time.TimeSeries;
import org.jfree.data.time.TimeSeriesCollection;
import org.springframework.stereotype.Service;
import ru.slivkiai.flowdetect.domain.entity.StopHistoryEntity;
import ru.slivkiai.flowdetect.repository.StopHistoryRepository;

import java.awt.*;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Base64;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ChartService {

    private final StopHistoryRepository stopHistoryRepository;

    public String generateLoadChartForLast12Hours(String address) throws IOException {
        // Получаем данные за последние 12 часов
        LocalDateTime endTime = LocalDateTime.now();
        LocalDateTime startTime = endTime.minusHours(12);

        List<StopHistoryEntity> historyData = stopHistoryRepository
                .findByAddressAndDatetimeBetween(address, startTime, endTime);

        // Группируем данные по часам и вычисляем среднее значение
        Map<Hour, Double> hourlyAverages = historyData.stream()
                .collect(Collectors.groupingBy(
                        record -> {
                            Date recordDate = Date.from(record.getDatetime()
                                    .atZone(ZoneId.systemDefault())
                                    .toInstant());
                            return new Hour(recordDate);
                        },
                        Collectors.averagingInt(StopHistoryEntity::getLoad)
                ));

        // Создаем временной ряд для данных
        TimeSeries loadSeries = new TimeSeries("Загруженность");

        // Добавляем усредненные значения
        hourlyAverages.forEach((hour, avgLoad) ->
                loadSeries.addOrUpdate(hour, avgLoad)
        );

        // Создаем набор данных
        TimeSeriesCollection dataset = new TimeSeriesCollection();
        dataset.addSeries(loadSeries);

        // Создаем график
        JFreeChart chart = ChartFactory.createTimeSeriesChart(
                "Загруженность остановки '" + address + "' за последние 12 часов",
                "Время",
                "Уровень загруженности (средний)",
                dataset,
                true,
                true,
                false
        );

        // Настраиваем внешний вид графика
        chart.setBackgroundPaint(Color.white);
        chart.getPlot().setBackgroundPaint(new Color(240, 240, 240));
        chart.getPlot().setOutlinePaint(Color.white);
        chart.getXYPlot().setDomainGridlinePaint(Color.white);
        chart.getXYPlot().setRangeGridlinePaint(Color.white);

        // Улучшаем читаемость графика
        chart.getXYPlot().getRenderer().setSeriesPaint(0, new Color(0, 102, 204));
        chart.getXYPlot().getDomainAxis().setLowerMargin(0.02);
        chart.getXYPlot().getDomainAxis().setUpperMargin(0.02);

        // Конвертируем график в PNG
        ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
        ChartUtils.writeChartAsPNG(outputStream, chart, 800, 400);
        byte[] chartBytes = outputStream.toByteArray();

        // Возвращаем base64 строку изображения
        return Base64.getEncoder().encodeToString(chartBytes);
    }
}