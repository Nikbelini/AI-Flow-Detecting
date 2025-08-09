package ru.slivkiai.flowdetect.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import ru.slivkiai.flowdetect.domain.entity.StopEntity;
import ru.slivkiai.flowdetect.domain.entity.StopHistoryEntity;

import java.util.Arrays;
import java.util.List;

@Repository
public interface StopRepository extends JpaRepository<StopEntity, Long> {
    List<StopEntity> getByCityId(Long cityId);
}
