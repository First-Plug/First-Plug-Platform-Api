/**
 * 🔒 Safe Team Population Helper
 * Maneja la population de teams de forma segura para registros legacy y nuevos
 * Incluye validaciones, error handling y logging
 */

import { Model } from 'mongoose';
import { isValidObjectId } from 'mongoose';
import { Team } from 'src/teams/schemas/team.schema';
import { LegacyRecordDetector } from './legacy-detector.helper';

export class SafeTeamPopulation {
  
  /**
   * 🔒 Poblar team de forma segura en un objeto de datos
   */
  static async populateTeamSafely(
    teamRepository: Model<Team>,
    data: any,
    fieldPath: string = 'team'
  ): Promise<boolean> {
    if (!data || typeof data !== 'object') {
      return false;
    }

    const teamId = this.getNestedValue(data, fieldPath);
    
    if (!teamId || typeof teamId !== 'string') {
      return false; // No hay team ID o no es string
    }

    if (!isValidObjectId(teamId)) {
      console.warn(`⚠️  Invalid ObjectId for team: "${teamId}" at path "${fieldPath}"`);
      return false;
    }

    try {
      const team = await teamRepository.findById(teamId).exec();
      
      if (team) {
        this.setNestedValue(data, fieldPath, team);
        return true;
      } else {
        console.warn(`⚠️  Team not found: "${teamId}" at path "${fieldPath}"`);
        return false;
      }
    } catch (error) {
      console.warn(`⚠️  Error populating team "${teamId}" at path "${fieldPath}":`, error.message);
      return false;
    }
  }

  /**
   * 🔒 Poblar teams en un registro de history completo
   */
  static async populateTeamsInHistoryRecord(
    teamRepository: Model<Team>,
    record: any
  ): Promise<void> {
    if (!record || !record.changes) {
      return;
    }

    const isLegacy = LegacyRecordDetector.isLegacyRecord(record);
    
    // Para registros legacy, ser más conservador con la population
    if (isLegacy) {
      console.log(`🔍 Processing legacy record for team population: ${record._id || 'unknown'}`);
    }

    // Poblar teams según el tipo de item y acción
    if (record.itemType === 'members' && record.actionType === 'bulk-create') {
      await this.populateTeamsInBulkMembers(teamRepository, record.changes.newData);
    } else if (
      (record.itemType === 'members' && ['update', 'create', 'delete'].includes(record.actionType)) ||
      (record.itemType === 'teams' && ['reassign', 'assign', 'unassign'].includes(record.actionType))
    ) {
      // Poblar en oldData
      if (record.changes.oldData) {
        await this.populateTeamSafely(teamRepository, record.changes.oldData, 'team');
      }
      
      // Poblar en newData
      if (record.changes.newData) {
        await this.populateTeamSafely(teamRepository, record.changes.newData, 'team');
      }
    }
  }

  /**
   * 🔒 Poblar teams en array de members (bulk-create)
   */
  private static async populateTeamsInBulkMembers(
    teamRepository: Model<Team>,
    members: any[]
  ): Promise<void> {
    if (!Array.isArray(members)) {
      return;
    }

    const populationPromises = members.map(async (member, index) => {
      if (member && member.team) {
        const success = await this.populateTeamSafely(teamRepository, member, 'team');
        if (!success) {
          console.warn(`⚠️  Failed to populate team for member at index ${index}`);
        }
      }
    });

    await Promise.all(populationPromises);
  }

  /**
   * 🔧 Obtener valor anidado de un objeto usando dot notation
   */
  private static getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  /**
   * 🔧 Establecer valor anidado en un objeto usando dot notation
   */
  private static setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    const lastKey = keys.pop();
    
    if (!lastKey) return;

    const target = keys.reduce((current, key) => {
      if (!current[key] || typeof current[key] !== 'object') {
        current[key] = {};
      }
      return current[key];
    }, obj);

    target[lastKey] = value;
  }

  /**
   * 📊 Obtener estadísticas de population para debugging
   */
  static async getPopulationStats(
    teamRepository: Model<Team>,
    records: any[]
  ): Promise<{
    totalRecords: number;
    recordsWithTeams: number;
    successfulPopulations: number;
    failedPopulations: number;
    invalidObjectIds: number;
    teamsNotFound: number;
  }> {
    const stats = {
      totalRecords: records.length,
      recordsWithTeams: 0,
      successfulPopulations: 0,
      failedPopulations: 0,
      invalidObjectIds: 0,
      teamsNotFound: 0
    };

    for (const record of records) {
      if (this.recordHasTeamReferences(record)) {
        stats.recordsWithTeams++;
        
        // Simular population para obtener estadísticas
        const teamIds = this.extractTeamIds(record);
        
        for (const teamId of teamIds) {
          if (!isValidObjectId(teamId)) {
            stats.invalidObjectIds++;
            stats.failedPopulations++;
            continue;
          }

          try {
            const team = await teamRepository.findById(teamId).exec();
            if (team) {
              stats.successfulPopulations++;
            } else {
              stats.teamsNotFound++;
              stats.failedPopulations++;
            }
          } catch (error) {
            stats.failedPopulations++;
          }
        }
      }
    }

    return stats;
  }

  /**
   * 🔍 Verificar si un registro tiene referencias a teams
   */
  private static recordHasTeamReferences(record: any): boolean {
    if (!record || !record.changes) return false;

    const hasTeamInOldData = record.changes.oldData && record.changes.oldData.team;
    const hasTeamInNewData = record.changes.newData && (
      record.changes.newData.team ||
      (Array.isArray(record.changes.newData) && 
       record.changes.newData.some((item: any) => item && item.team))
    );

    return hasTeamInOldData || hasTeamInNewData;
  }

  /**
   * 🔍 Extraer todos los team IDs de un registro
   */
  private static extractTeamIds(record: any): string[] {
    const teamIds: string[] = [];

    if (record.changes?.oldData?.team && typeof record.changes.oldData.team === 'string') {
      teamIds.push(record.changes.oldData.team);
    }

    if (record.changes?.newData?.team && typeof record.changes.newData.team === 'string') {
      teamIds.push(record.changes.newData.team);
    }

    if (Array.isArray(record.changes?.newData)) {
      record.changes.newData.forEach((item: any) => {
        if (item && item.team && typeof item.team === 'string') {
          teamIds.push(item.team);
        }
      });
    }

    return [...new Set(teamIds)]; // Eliminar duplicados
  }
}
