import { FilterQuery, Query } from 'mongoose';
import { Team } from 'src/teams/schemas/team.schema';

export interface ITeamsService {
  bulkCreate(teamsToCreate: any[], session?: any): Promise<any[]>;
  find(filter: FilterQuery<Team>): Query<Team[], Team>;
}
