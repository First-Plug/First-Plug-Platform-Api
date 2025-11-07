/**
 * 🔒 Safe Team Population Helper
 * Maneja la population de teams de forma segura para registros legacy y nuevos
 * Incluye validaciones, error handling y logging
 */

import { Model } from 'mongoose';
import { isValidObjectId } from 'mongoose';
import { Team } from 'src/teams/schemas/team.schema';

export class SafeTeamPopulation {
  /**
   * 🔒 Poblar team de forma segura en un objeto de datos
   */
  static async populateTeamSafely(
    teamRepository: Model<Team>,
    data: any,
    fieldPath: string = 'team',
  ): Promise<boolean> {
    if (!data || typeof data !== 'object') {
      return false;
    }

    const teamId = this.getNestedValue(data, fieldPath);

    if (!teamId || typeof teamId !== 'string') {
      return false; // No hay team ID o no es string
    }

    if (!isValidObjectId(teamId)) {
      return false;
    }

    try {
      const team = await teamRepository.findById(teamId).exec();

      if (team) {
        this.setNestedValue(data, fieldPath, team);
        return true;
      } else {
        return false;
      }
    } catch (error) {
      return false;
    }
  }

  /**
   * 🔒 Poblar teams en un registro de history completo
   */
  static async populateTeamsInHistoryRecord(
    teamRepository: Model<Team>,
    record: any,
  ): Promise<void> {
    if (!record || !record.changes) {
      return;
    }

    // Poblar teams según el tipo de item y acción
    if (record.itemType === 'members' && record.actionType === 'bulk-create') {
      await this.populateTeamsInBulkMembers(
        teamRepository,
        record.changes.newData,
      );
    } else if (
      (record.itemType === 'members' &&
        ['update', 'create', 'delete'].includes(record.actionType)) ||
      (record.itemType === 'teams' &&
        ['reassign', 'assign', 'unassign'].includes(record.actionType))
    ) {
      // Poblar en oldData
      if (record.changes.oldData) {
        await this.populateTeamSafely(
          teamRepository,
          record.changes.oldData,
          'team',
        );
      }

      // Poblar en newData
      if (record.changes.newData) {
        await this.populateTeamSafely(
          teamRepository,
          record.changes.newData,
          'team',
        );
      }
    }
  }

  /**
   * 🔒 Poblar teams en array de members (bulk-create)
   */
  private static async populateTeamsInBulkMembers(
    teamRepository: Model<Team>,
    members: any[],
  ): Promise<void> {
    if (!Array.isArray(members)) {
      return;
    }

    const populationPromises = members.map(async (member) => {
      if (member && member.team) {
        await this.populateTeamSafely(teamRepository, member, 'team');
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
}
